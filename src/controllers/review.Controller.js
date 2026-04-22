
import mongoose from "mongoose";
import Review from "../models/Review.model.js";
import Product from "../models/Product.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";


const sanitise = (str = "") =>
    String(str)
        .replace(/<[^>]*>/g, "")
        .replace(/[{}$]/g, "")
        .trim();


const shapeReview = (review) => {
    const obj = review.toObject ? review.toObject() : { ...review };
    const user = obj.userId;

    if (user?.name?.trim()) {
        obj.displayName = user.name.trim();
    } else if (user?.email) {
        const prefix = user.email.split("@")[0] ?? "";
        obj.displayName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    } else {
        obj.displayName = "Anonymous";
    }

    obj.userAvatar =
        user?.avatar?.url ||
        user?.profilePhoto?.url ||
        user?.photo?.url ||
        null;

    return obj;
};


const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);



//  ADD REVIEW

const addReview = async (req, res) => {
    try {
        const userId    = req.user._id;
        const productId = sanitise(req.body.productId ?? "");
        const comment   = sanitise(req.body.comment   ?? "");
        const title     = sanitise(req.body.title     ?? "");
        const rating    = Number(req.body.rating);

        if (!isValidId(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID." });
        }
        if (!rating || !comment) {
            return res.status(400).json({ success: false, message: "Rating and comment are required." });
        }
        if (isNaN(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
        }
        if (comment.length < 10) {
            return res.status(400).json({ success: false, message: "Comment must be at least 10 characters." });
        }
        if (comment.length > 1000) {
            return res.status(400).json({ success: false, message: "Comment cannot exceed 1000 characters." });
        }

        const product = await Product.findById(productId).lean();
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        // Bug fix: check for duplicate review before attempting to create
        const existing = await Review.findOne({ productId, userId });
        if (existing) {
            return res.status(409).json({ success: false, message: "You have already reviewed this product." });
        }

        const imageArray = [];
        if (req.files?.length > 0) {
            const files = req.files.slice(0, 5);
            for (const file of files) {
                const result = await uploadOnCloudinary(file.path, "reviews");
                if (result) {
                    imageArray.push({
                        url       : result.secure_url || result.url,
                        public_id : result.public_id,
                    });
                }
            }
        }

      
        const review = await Review.create({
            productId,
            userId,
            rating,
            title,
            comment,
            images: imageArray,
        });

        await Product.findByIdAndUpdate(productId, { $push: { reviews: review._id } });

        await review.populate("userId", "name email avatar profilePhoto photo");

        return res.status(201).json({
            success : true,
            message : "Review submitted successfully.",
            data    : shapeReview(review),
        });

    } catch (error) {
        console.error("[addReview]", error);
        return res.status(500).json({
            success : false,
            message : "Failed to submit review. Try again.",
        });
    }
};



//  UPDATE REVIEW

const updateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId  = req.user._id;
        const isAdmin = req.user.role === "admin";

        if (!isValidId(reviewId)) {
            return res.status(400).json({ success: false, message: "Invalid review ID." });
        }

        const comment = sanitise(req.body.comment ?? "");
        const title   = sanitise(req.body.title   ?? "");
        const rating  = req.body.rating ? Number(req.body.rating) : null;

        if (rating !== null && (isNaN(rating) || rating < 1 || rating > 5)) {
            return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
        }
        if (comment && comment.length < 10) {
            return res.status(400).json({ success: false, message: "Comment must be at least 10 characters." });
        }
        if (comment && comment.length > 1000) {
            return res.status(400).json({ success: false, message: "Comment cannot exceed 1000 characters." });
        }

        const query  = isAdmin ? { _id: reviewId } : { _id: reviewId, userId };
        const review = await Review.findOne(query);

        if (!review) {
            return res.status(404).json({
                success : false,
                message : "Review not found or you do not have permission to update it.",
            });
        }

        if (req.files?.length > 0) {
            for (const img of review.images ?? []) {
                if (img.public_id) {
                    await deleteFromCloudinary(img.public_id).catch((e) =>
                        console.warn("[updateReview] Image delete failed:", e.message)
                    );
                }
            }
            const newImages = [];
            for (const file of req.files.slice(0, 5)) {
                const result = await uploadOnCloudinary(file.path, "reviews");
                if (result) {
                    newImages.push({
                        url       : result.secure_url || result.url,
                        public_id : result.public_id,
                    });
                }
            }
            review.images = newImages;
        }

        if (rating !== null) review.rating  = rating;
        if (title)            review.title   = title;
        if (comment)          review.comment = comment;
        review.isEdited = true;

        await review.save();

        await review.populate("userId", "name email avatar profilePhoto photo");

        return res.status(200).json({
            success : true,
            message : "Review updated successfully.",
            data    : shapeReview(review),
        });
    } catch (error) {
        console.error("[updateReview]", error);
        return res.status(500).json({ success: false, message: "Failed to update review." });
    }
};



//  DELETE REVIEW

const deleteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId  = req.user._id;
        const isAdmin = req.user.role === "admin";

        if (!isValidId(reviewId)) {
            return res.status(400).json({ success: false, message: "Invalid review ID." });
        }

        const query  = isAdmin ? { _id: reviewId } : { _id: reviewId, userId };
        const review = await Review.findOneAndDelete(query);

        if (!review) {
            return res.status(404).json({
                success : false,
                message : "Review not found or you do not have permission.",
            });
        }

        for (const img of review.images ?? []) {
            if (img.public_id) {
                await deleteFromCloudinary(img.public_id).catch((e) =>
                    console.warn("[deleteReview] Image delete failed:", e.message)
                );
            }
        }

        await Product.findByIdAndUpdate(review.productId, {
            $pull: { reviews: review._id },
        });

        return res.status(200).json({ success: true, message: "Review deleted successfully." });
    } catch (error) {
        console.error("[deleteReview]", error);
        return res.status(500).json({ success: false, message: "Failed to delete review." });
    }
};




const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!isValidId(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID." });
        }

        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(50, parseInt(req.query.limit) || 10);
        const rating = parseInt(req.query.rating) || null;
        const sort   = req.query.sort || "recent";

        const product = await Product.findById(productId).lean();
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        const filter = { productId, status: "active" };
        if (rating && rating >= 1 && rating <= 5) filter.rating = rating;

        const sortOptions = {
            recent      : { createdAt: -1 },
            helpful     : { helpfulVotes: -1, createdAt: -1 },
            rating_high : { rating: -1, createdAt: -1 },
            rating_low  : { rating: 1,  createdAt: -1 },
        };
        const sortQuery = sortOptions[sort] ?? sortOptions.recent;

        const [reviews, totalReviews] = await Promise.all([
            Review.find(filter)
                .populate("userId", "name email avatar profilePhoto photo")
                .sort(sortQuery)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean({ virtuals: true }),
            Review.countDocuments(filter),
        ]);

        const ratingDist = await Review.aggregate([
            { $match: { productId: new mongoose.Types.ObjectId(productId), status: "active" } },
            { $group: { _id: "$rating", count: { $sum: 1 } } },
        ]);

        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratingDist.forEach(({ _id, count }) => { distribution[_id] = count; });

        return res.status(200).json({
            success     : true,
            data        : reviews.map(shapeReview),
            totalReviews,
            totalPages  : Math.ceil(totalReviews / limit),
            currentPage : page,
            distribution,
        });
    } catch (error) {
        console.error("[getProductReviews]", error);
        return res.status(500).json({ success: false, message: "Failed to fetch reviews." });
    }
};




const getMyReviews = async (req, res) => {
    try {
        const userId = req.user._id;
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(50, parseInt(req.query.limit) || 10);

        const [reviews, totalReviews] = await Promise.all([
            Review.find({ userId })
                .populate("productId", "name images price")
                .populate("userId",    "name email avatar profilePhoto photo")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Review.countDocuments({ userId }),
        ]);

        return res.status(200).json({
            success     : true,
            data        : reviews.map(shapeReview),
            totalReviews,
            totalPages  : Math.ceil(totalReviews / limit),
            currentPage : page,
        });
    } catch (error) {
        console.error("[getMyReviews]", error);
        return res.status(500).json({ success: false, message: "Failed to fetch your reviews." });
    }
};




const markHelpful = async (req, res) => {
    try {
        const { reviewId } = req.params;

        if (!isValidId(reviewId)) {
            return res.status(400).json({ success: false, message: "Invalid review ID." });
        }

        const review = await Review.findByIdAndUpdate(
            reviewId,
            { $inc: { helpfulVotes: 1 } },
            { returnDocument: 'after' }
        );

        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found." });
        }

        return res.status(200).json({
            success      : true,
            message      : "Marked as helpful.",
            helpfulVotes : review.helpfulVotes,
        });
    } catch (error) {
        console.error("[markHelpful]", error);
        return res.status(500).json({ success: false, message: "An error occurred." });
    }
};




const adminGetAllReviews = async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(100, parseInt(req.query.limit) || 20);
        const status = req.query.status || null;

        const filter = status ? { status } : {};

        const [reviews, totalReviews] = await Promise.all([
            Review.find(filter)
                .populate("userId",    "name email avatar profilePhoto photo")
                .populate("productId", "name")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Review.countDocuments(filter),
        ]);

        return res.status(200).json({
            success     : true,
            data        : reviews.map(shapeReview),
            totalReviews,
            totalPages  : Math.ceil(totalReviews / limit),
            currentPage : page,
        });
    } catch (error) {
        console.error("[adminGetAllReviews]", error);
        return res.status(500).json({ success: false, message: "An error occurred." });
    }
};




const adminUpdateStatus = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { status }   = req.body;

        if (!["active", "hidden", "flagged"].includes(status)) {
            return res.status(400).json({
                success : false,
                message : "Invalid status. Use: active, hidden, flagged",
            });
        }

        const review = await Review.findByIdAndUpdate(
            reviewId,
            { status },
            { returnDocument: 'after' }
        ).populate("userId", "name email avatar profilePhoto photo");

        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found." });
        }

        await Review.recalculateProductRating(review.productId);

        return res.status(200).json({
            success : true,
            message : `Review status updated to "${status}".`,
            data    : shapeReview(review),
        });
    } catch (error) {
        console.error("[adminUpdateStatus]", error);
        return res.status(500).json({ success: false, message: "An error occurred." });
    }
};


export {
    addReview,
    updateReview,
    deleteReview,
    getProductReviews,
    getMyReviews,
    markHelpful,
    adminGetAllReviews,
    adminUpdateStatus,
};