import mongoose from "mongoose";
import Review from "./review.model.js";
import Product from "../products/product.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ROLES } from "../../shared/constants/roles.js";

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

    obj.userAvatar = user?.avatar?.url || user?.profilePhoto?.url || user?.photo?.url || null;
    return obj;
};

class ReviewService {
    static async addReview(reviewData, user, files) {
        const userId = user._id;
        const { productId, rating, title, comment } = reviewData;

        const product = await Product.findById(productId).lean();
        if (!product) throw new ApiError(404, "Product not found.");

        const existing = await Review.findOne({ productId, userId });
        if (existing) throw new ApiError(409, "You have already reviewed this product.");

        const imageArray = [];
        if (files?.length > 0) {
            for (const file of files.slice(0, 5)) {
                const result = await uploadOnCloudinary(file.path, "reviews");
                if (result) {
                    imageArray.push({
                        url: result.secure_url || result.url,
                        public_id: result.public_id,
                    });
                }
            }
        }

        const review = await Review.create({
            productId,
            userId,
            rating,
            title: sanitise(title),
            comment: sanitise(comment),
            images: imageArray,
        });

        await Product.findByIdAndUpdate(productId, { $push: { reviews: review._id } });
        await review.populate("userId", "name email avatar profilePhoto photo");

        return shapeReview(review);
    }

    static async updateReview(reviewId, updateData, user, files) {
        const userId = user._id;
        const isAdmin = user.role === ROLES.ADMIN;
        const { rating, title, comment } = updateData;

        const query = isAdmin ? { _id: reviewId } : { _id: reviewId, userId };
        const review = await Review.findOne(query);
        if (!review) throw new ApiError(404, "Review not found or permission denied.");

        if (files?.length > 0) {
            for (const img of review.images ?? []) {
                if (img.public_id) await deleteFromCloudinary(img.public_id).catch(() => {});
            }
            const newImages = [];
            for (const file of files.slice(0, 5)) {
                const result = await uploadOnCloudinary(file.path, "reviews");
                if (result) {
                    newImages.push({
                        url: result.secure_url || result.url,
                        public_id: result.public_id,
                    });
                }
            }
            review.images = newImages;
        }

        if (rating) review.rating = rating;
        if (title) review.title = sanitise(title);
        if (comment) review.comment = sanitise(comment);
        review.isEdited = true;

        await review.save();
        await review.populate("userId", "name email avatar profilePhoto photo");

        return shapeReview(review);
    }

    static async deleteReview(reviewId, user) {
        const userId = user._id;
        const isAdmin = user.role === ROLES.ADMIN;

        const query = isAdmin ? { _id: reviewId } : { _id: reviewId, userId };
        const review = await Review.findOneAndDelete(query);
        if (!review) throw new ApiError(404, "Review not found or permission denied.");

        for (const img of review.images ?? []) {
            if (img.public_id) await deleteFromCloudinary(img.public_id).catch(() => {});
        }

        await Product.findByIdAndUpdate(review.productId, { $pull: { reviews: review._id } });
    }

    static async getProductReviews(productId, query) {
        const { page, limit, rating, sort } = query;

        const product = await Product.findById(productId).lean();
        if (!product) throw new ApiError(404, "Product not found.");

        const filter = { productId, status: "active" };
        if (rating) filter.rating = rating;

        const sortOptions = {
            recent: { createdAt: -1 },
            helpful: { helpfulVotes: -1, createdAt: -1 },
            rating_high: { rating: -1, createdAt: -1 },
            rating_low: { rating: 1, createdAt: -1 },
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

        return {
            reviews: reviews.map(shapeReview),
            totalReviews,
            totalPages: Math.ceil(totalReviews / limit),
            currentPage: page,
            distribution,
        };
    }

    static async getMyReviews(userId, query) {
        const { page, limit } = query;

        const [reviews, totalReviews] = await Promise.all([
            Review.find({ userId })
                .populate("productId", "name images price")
                .populate("userId", "name email avatar profilePhoto photo")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Review.countDocuments({ userId }),
        ]);

        return {
            reviews: reviews.map(shapeReview),
            totalReviews,
            totalPages: Math.ceil(totalReviews / limit),
            currentPage: page,
        };
    }

    static async markHelpful(reviewId) {
        const review = await Review.findByIdAndUpdate(
            reviewId,
            { $inc: { helpfulVotes: 1 } },
            { returnDocument: 'after' }
        );

        if (!review) throw new ApiError(404, "Review not found.");
        return review.helpfulVotes;
    }

    static async adminGetAllReviews(query) {
        const { page, limit, status } = query;
        const filter = status ? { status } : {};

        const [reviews, totalReviews] = await Promise.all([
            Review.find(filter)
                .populate("userId", "name email avatar profilePhoto photo")
                .populate("productId", "name")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Review.countDocuments(filter),
        ]);

        return {
            reviews: reviews.map(shapeReview),
            totalReviews,
            totalPages: Math.ceil(totalReviews / limit),
            currentPage: page,
        };
    }

    static async adminUpdateStatus(reviewId, status) {
        const review = await Review.findByIdAndUpdate(
            reviewId,
            { status },
            { returnDocument: 'after' }
        ).populate("userId", "name email avatar profilePhoto photo");

        if (!review) throw new ApiError(404, "Review not found.");

        await Review.recalculateProductRating(review.productId);
        return shapeReview(review);
    }

    static async getVendorReviews(vendorId, query) {
        const { page, limit } = query;
        const products = await Product.find({ vendorId }).select("_id").lean();
        const productIds = products.map(p => p._id);

        const [reviews, totalReviews] = await Promise.all([
            Review.find({ productId: { $in: productIds } })
                .populate("productId", "name images")
                .populate("userId", "name email avatar profilePhoto photo")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Review.countDocuments({ productId: { $in: productIds } }),
        ]);

        return {
            reviews: reviews.map(shapeReview),
            totalReviews,
            totalPages: Math.ceil(totalReviews / limit),
            currentPage: page,
        };
    }

    static async vendorRespondToReview(reviewId, response, vendorId) {
        const review = await Review.findById(reviewId).populate("productId", "vendorId");
        if (!review) throw new ApiError(404, "Review not found.");

        if (review.productId.vendorId.toString() !== vendorId.toString()) {
            throw new ApiError(403, "You can only respond to reviews for your own products.");
        }

        review.vendorResponse = {
            comment: sanitise(response),
            respondedAt: new Date()
        };

        await review.save();
        return shapeReview(review);
    }
}

export default ReviewService;
