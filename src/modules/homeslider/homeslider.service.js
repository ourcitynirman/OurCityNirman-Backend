import HomeSlider from "./homeslider.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";
import { ApiError } from "../../shared/utils/api.utils.js";

class HomeSliderService {
    static async getActiveSlides() {
        return await HomeSlider.getActiveSlides();
    }

    static async getAllSlides(query) {
        const { page, limit, isActive, sort } = query;
        const skip = (page - 1) * limit;
        const filter = {};
        if (isActive !== undefined) filter.isActive = isActive === "true";

        const sortOptions = sort.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort]: 1 };

        const [slides, total] = await Promise.all([
            HomeSlider.find(filter).populate("createdBy", "fullName email").populate("updatedBy", "fullName email").sort(sortOptions).skip(skip).limit(limit),
            HomeSlider.countDocuments(filter),
        ]);

        return { slides, total, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    static async getSlideById(id) {
        const slide = await HomeSlider.findById(id).populate("createdBy", "fullName email").populate("updatedBy", "fullName email");
        if (!slide) throw new ApiError(404, "Slide not found");
        return slide;
    }

    static async createSlide(data, files, user) {
        const { title, subtitle, buttonText, link, order, isActive, duration, image: imageUrl } = data;
        let finalImageUrl = imageUrl;
        let imagePublicId = null;

        const imageLocalPath = files?.image?.[0]?.path;
        if (imageLocalPath) {
            const uploaded = await uploadOnCloudinary(imageLocalPath);
            if (!uploaded?.url) throw new ApiError(500, "Image upload failed");
            finalImageUrl = uploaded.url;
            imagePublicId = uploaded.public_id;
        }

        if (!finalImageUrl) throw new ApiError(400, "Image required");

        let slideOrder = order;
        if (slideOrder === undefined) {
            const lastSlide = await HomeSlider.findOne().sort({ order: -1 });
            slideOrder = lastSlide ? lastSlide.order + 1 : 0;
        }

        return await HomeSlider.create({
            title, subtitle, image: finalImageUrl, imagePublicId, buttonText, link, order: slideOrder,
            isActive, duration: duration || 5000, createdBy: user._id, updatedBy: user._id
        });
    }

    static async updateSlide(id, data, files, user) {
        const slide = await HomeSlider.findById(id);
        if (!slide) throw new ApiError(404, "Slide not found");

        const { title, subtitle, buttonText, link, order, isActive, duration, image: imageUrl } = data;
        const imageLocalPath = files?.image?.[0]?.path;

        if (imageLocalPath) {
            if (slide.imagePublicId) await deleteFromCloudinary(slide.imagePublicId);
            const uploaded = await uploadOnCloudinary(imageLocalPath);
            if (!uploaded?.url) throw new ApiError(500, "Image upload failed");
            slide.image = uploaded.url;
            slide.imagePublicId = uploaded.public_id;
        } else if (imageUrl) {
            slide.image = imageUrl;
        }

        if (title !== undefined) slide.title = title;
        if (subtitle !== undefined) slide.subtitle = subtitle;
        if (buttonText !== undefined) slide.buttonText = buttonText;
        if (link !== undefined) slide.link = link;
        if (order !== undefined) slide.order = order;
        if (isActive !== undefined) slide.isActive = isActive;
        if (duration !== undefined) slide.duration = duration;
        slide.updatedBy = user._id;

        return await slide.save();
    }

    static async toggleSlideStatus(id, user) {
        const slide = await HomeSlider.findById(id);
        if (!slide) throw new ApiError(404, "Slide not found");
        slide.isActive = !slide.isActive;
        slide.updatedBy = user._id;
        return await slide.save();
    }

    static async reorderSlides(slides) {
        return await HomeSlider.reorder(slides);
    }

    static async bulkUpdateSlides(slideIds, updates, user) {
        return await HomeSlider.updateMany({ _id: { $in: slideIds } }, { $set: { ...updates, updatedBy: user._id } });
    }

    static async deleteSlide(id, user) {
        const slide = await HomeSlider.findById(id);
        if (!slide) throw new ApiError(404, "Slide not found");
        slide.isActive = false;
        slide.updatedBy = user._id;
        return await slide.save();
    }

    static async permanentDeleteSlide(id) {
        const slide = await HomeSlider.findById(id);
        if (!slide) throw new ApiError(404, "Slide not found");
        if (slide.imagePublicId) await deleteFromCloudinary(slide.imagePublicId);
        return await HomeSlider.findByIdAndDelete(id);
    }

    static async getSlideStats() {
        const stats = await HomeSlider.aggregate([
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: 1 },
                                active: { $sum: { $cond: ["$isActive", 1, 0] } },
                                inactive: { $sum: { $cond: ["$isActive", 0, 1] } },
                            },
                        },
                    ],
                    recent: [
                        { $sort: { createdAt: -1 } },
                        { $limit: 5 },
                        { $project: { title: 1, isActive: 1, order: 1, createdAt: 1 } },
                    ],
                },
            },
        ]);

        const result = stats[0];
        return {
            summary: result.totals[0] || { total: 0, active: 0, inactive: 0 },
            recentSlides: result.recent,
        };
    }
}

export default HomeSliderService;
