import mongoose from "mongoose";
import HomeSlider from "../../models/Homeslider.model.js";
import { User } from "../../models/user.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";
import ApiError from "../../utils/ApiError.js";
import asyncHandler from "../../utils/asyncHandler.js";

const getActiveSlides = asyncHandler(async (req, res) => {
    const slides = await HomeSlider.getActiveSlides();
    res.status(200).json({ success: true, count: slides.length, data: slides });
});

const getAllSlides = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, isActive, sort = "order" } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const sortOptions = {};
    if (sort.startsWith("-")) {
        sortOptions[sort.slice(1)] = -1;
    } else {
        sortOptions[sort] = 1;
    }

    const [slides, total] = await Promise.all([
        HomeSlider.find(filter)
            .populate("createdBy", "fullName email")
            .populate("updatedBy", "fullName email")
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum),
        HomeSlider.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        data: slides,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            hasNextPage: pageNum * limitNum < total,
            hasPrevPage: pageNum > 1,
        },
    });
});

const getSlideById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid slide ID format");

    const slide = await HomeSlider.findById(id)
        .populate("createdBy", "fullName email")
        .populate("updatedBy", "fullName email");

    if (!slide) throw new ApiError(404, "Slide not found");

    res.status(200).json({ success: true, data: slide });
});

const getSlideStats = asyncHandler(async (req, res) => {
    const stats = await HomeSlider.getSlideStats();
    res.status(200).json({ success: true, stats });
});

const createSlide = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new ApiError(401, "Unauthorized access");

    const { title, subtitle, buttonText, link, order, isActive, duration, image: imageUrl } = req.body;

    if (!title || !title.trim()) throw new ApiError(400, "Slide title is required");

    let finalImageUrl = imageUrl;
    let imagePublicId = null;

    const imageLocalPath = req.files?.image?.[0]?.path;

    if (imageLocalPath) {
        const uploaded = await uploadOnCloudinary(imageLocalPath);
        if (!uploaded?.url) throw new ApiError(500, "Image upload to Cloudinary failed");
        finalImageUrl = uploaded.url;
        imagePublicId = uploaded.public_id;
    }

    if (!finalImageUrl) throw new ApiError(400, "Slide image is required — upload a file or provide an image URL");

    let slideOrder = parseInt(order);
    if (isNaN(slideOrder)) {
        const lastSlide = await HomeSlider.findOne().sort({ order: -1 });
        slideOrder = lastSlide ? lastSlide.order + 1 : 0;
    }

    const slide = await HomeSlider.create({
        title: title.trim(),
        subtitle: subtitle?.trim() || "",
        image: finalImageUrl,
        imagePublicId,
        buttonText: buttonText?.trim() || "Shop Now",
        link: link?.trim() || "/",
        order: slideOrder,
        isActive: isActive === "true" || isActive === true,
        duration: parseInt(duration) || 5000,
        createdBy: req.user._id,
        updatedBy: req.user._id,
    });

    res.status(201).json({ success: true, message: "Slide created successfully", data: slide });
});

const updateSlide = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new ApiError(401, "Unauthorized access");

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid slide ID format");

    const slide = await HomeSlider.findById(id);
    if (!slide) throw new ApiError(404, "Slide not found");

    const { title, subtitle, buttonText, link, order, isActive, duration, image: imageUrl } = req.body;

    const imageLocalPath = req.files?.image?.[0]?.path;

    if (imageLocalPath) {
        if (slide.imagePublicId) await deleteFromCloudinary(slide.imagePublicId);
        const uploaded = await uploadOnCloudinary(imageLocalPath);
        if (!uploaded?.url) throw new ApiError(500, "Image upload failed");
        slide.image = uploaded.url;
        slide.imagePublicId = uploaded.public_id;
    } else if (imageUrl && imageUrl.trim()) {
        slide.image = imageUrl.trim();
    }

    if (title !== undefined) slide.title = title.trim();
    if (subtitle !== undefined) slide.subtitle = subtitle.trim();
    if (buttonText !== undefined) slide.buttonText = buttonText.trim();
    if (link !== undefined) slide.link = link.trim();
    if (order !== undefined) slide.order = parseInt(order);
    if (isActive !== undefined) slide.isActive = isActive === "true" || isActive === true;
    if (duration !== undefined) slide.duration = parseInt(duration);
    slide.updatedBy = req.user._id;

    await slide.save();

    res.status(200).json({ success: true, message: "Slide updated successfully", data: slide });
});

const toggleSlideStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid slide ID format");

    const slide = await HomeSlider.findById(id);
    if (!slide) throw new ApiError(404, "Slide not found");

    slide.isActive = !slide.isActive;
    slide.updatedBy = req.user._id;
    await slide.save();

    res.status(200).json({
        success: true,
        message: `Slide ${slide.isActive ? "activated" : "deactivated"} successfully`,
        data: { _id: slide._id, isActive: slide.isActive },
    });
});

const reorderSlides = asyncHandler(async (req, res) => {
    const { slides } = req.body;

    if (!Array.isArray(slides) || slides.length === 0) throw new ApiError(400, "slides array is required and must not be empty");

    for (const s of slides) {
        if (!s.id || !mongoose.Types.ObjectId.isValid(s.id)) throw new ApiError(400, `Invalid slide id: ${s.id}`);
        if (typeof s.order !== "number" || s.order < 0) throw new ApiError(400, `Invalid order value for slide ${s.id}`);
    }

    await HomeSlider.reorder(slides);

    res.status(200).json({ success: true, message: `${slides.length} slide(s) reordered successfully` });
});

const bulkUpdateSlides = asyncHandler(async (req, res) => {
    const { slideIds, updates } = req.body;

    if (!Array.isArray(slideIds) || slideIds.length === 0) throw new ApiError(400, "slideIds array is required");
    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) throw new ApiError(400, "updates object is required");

    const allowedFields = ["isActive", "buttonText", "duration"];
    const sanitizedUpdates = {};
    for (const key of allowedFields) {
        if (updates[key] !== undefined) sanitizedUpdates[key] = updates[key];
    }

    if (Object.keys(sanitizedUpdates).length === 0) throw new ApiError(400, "No valid fields provided for bulk update");

    const result = await HomeSlider.updateMany(
        { _id: { $in: slideIds } },
        { $set: { ...sanitizedUpdates, updatedBy: req.user._id } }
    );

    res.status(200).json({ success: true, message: `${result.modifiedCount} slide(s) updated successfully`, data: { modifiedCount: result.modifiedCount } });
});

const deleteSlide = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid slide ID format");

    const slide = await HomeSlider.findById(id);
    if (!slide) throw new ApiError(404, "Slide not found");

    slide.isActive = false;
    slide.updatedBy = req.user._id;
    await slide.save();

    res.status(200).json({ success: true, message: "Slide deactivated successfully", data: { _id: slide._id, isActive: slide.isActive } });
});

const permanentDeleteSlide = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid slide ID format");

    const slide = await HomeSlider.findById(id);
    if (!slide) throw new ApiError(404, "Slide not found");

    if (slide.imagePublicId) await deleteFromCloudinary(slide.imagePublicId);

    await HomeSlider.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Slide permanently deleted", data: { _id: id } });
});

export {
    getActiveSlides,
    getAllSlides,
    getSlideById,
    getSlideStats,
    createSlide,
    updateSlide,
    toggleSlideStatus,
    reorderSlides,
    bulkUpdateSlides,
    deleteSlide,
    permanentDeleteSlide,
};