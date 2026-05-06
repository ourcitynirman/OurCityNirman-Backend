import mongoose from "mongoose";
import ShopReview from "./shop-review.model.js";
import Shop from "../shop/shop.model.js";
import OrderItem from "../orders/order-item.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";
import { ApiError } from "../../shared/utils/api.utils.js";

const sanitise = (str = "") =>
    String(str)
        .replace(/<[^>]*>/g, "")
        .replace(/[{}$]/g, "")
        .trim();

const shapeReview = (review) => {
    const obj = review.toObject ? review.toObject() : { ...review };
    const user = obj.userId;

    if (user?.fullName?.trim()) {
        obj.displayName = user.fullName.trim();
    } else if (user?.email) {
        const prefix = user.email.split("@")[0] ?? "";
        obj.displayName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    } else {
        obj.displayName = "Anonymous";
    }

    obj.userAvatar = user?.avatar || user?.profilePhoto || null;
    return obj;
};

class ShopReviewService {
    static async addShopReview(reviewData, user, files) {
        const userId = user._id;
        const { shopId, rating, title, comment } = reviewData;

        const shop = await Shop.findById(shopId).lean();
        if (!shop) throw new ApiError(404, "Shop not found.");

        const existing = await ShopReview.findOne({ shopId, userId });
        if (existing) throw new ApiError(409, "You have already reviewed this shop.");

        const hasPurchased = await OrderItem.findOne({ 
            user_id: userId, 
            vendor: shop.vendor, 
            itemStatus: 'delivered' 
        }).lean();

        const imageArray = [];
        if (files?.length > 0) {
            for (const file of files.slice(0, 5)) {
                const result = await uploadOnCloudinary(file.path, "shop-reviews");
                if (result) {
                    imageArray.push({
                        url: result.secure_url || result.url,
                        public_id: result.public_id,
                    });
                }
            }
        }

        const review = await ShopReview.create({
            shopId,
            userId,
            rating,
            title: sanitise(title),
            comment: sanitise(comment),
            images: imageArray,
            isVerifiedPurchase: !!hasPurchased
        });

        await review.populate("userId", "fullName email avatar");
        return shapeReview(review);
    }

    static async getShopReviews(shopId, query) {
        const { page, limit, sort } = query;

        const filter = { shopId, status: "active" };
        const sortOptions = {
            recent: { createdAt: -1 },
            helpful: { helpfulVotes: -1, createdAt: -1 },
            rating_high: { rating: -1, createdAt: -1 },
            rating_low: { rating: 1, createdAt: -1 },
        };

        const [reviews, totalReviews] = await Promise.all([
            ShopReview.find(filter)
                .populate("userId", "fullName email avatar")
                .sort(sortOptions[sort] || sortOptions.recent)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            ShopReview.countDocuments(filter),
        ]);

        return {
            reviews: reviews.map(shapeReview),
            pagination: {
                totalReviews,
                totalPages: Math.ceil(totalReviews / limit),
                currentPage: page,
            }
        };
    }

    static async updateShopReview(reviewId, updateData, user) {
        const userId = user._id;
        const { rating, title, comment } = updateData;

        const review = await ShopReview.findOne({ _id: reviewId, userId });
        if (!review) throw new ApiError(404, "Review not found or access denied.");

        if (rating) review.rating = rating;
        if (title) review.title = sanitise(title);
        if (comment) review.comment = sanitise(comment);
        review.isEdited = true;

        await review.save();
        await review.populate("userId", "fullName email avatar");

        return shapeReview(review);
    }

    static async deleteShopReview(reviewId, user) {
        const userId = user._id;
        const isAdmin = user.role === 'admin';

        const query = isAdmin ? { _id: reviewId } : { _id: reviewId, userId };
        const review = await ShopReview.findOne(query);
        
        if (!review) throw new ApiError(404, "Review not found.");

        for (const img of review.images) {
            if (img.public_id) await deleteFromCloudinary(img.public_id).catch(() => {});
        }

        await ShopReview.findByIdAndDelete(review._id);
    }

    static async vendorRespondToShopReview(reviewId, response, user) {
        const vendorId = user._id;

        const review = await ShopReview.findById(reviewId).populate("shopId", "vendor");
        if (!review) throw new ApiError(404, "Review not found.");

        if (review.shopId.vendor.toString() !== vendorId.toString()) {
            throw new ApiError(403, "Access denied. You can only respond to reviews for your own shop.");
        }

        review.vendorResponse = {
            comment: sanitise(response),
            respondedAt: new Date()
        };

        await review.save();
        return shapeReview(review);
    }

    static async markHelpful(reviewId) {
        const review = await ShopReview.findByIdAndUpdate(
            reviewId,
            { $inc: { helpfulVotes: 1 } },
            { new: true }
        );

        if (!review) throw new ApiError(404, "Review not found.");
        return review.helpfulVotes;
    }
}

export default ShopReviewService;
