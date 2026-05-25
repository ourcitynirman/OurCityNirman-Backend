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

        // Update Shop rating and stats
        const starKey = `ratingStats.star${rating}`;
        await Shop.findByIdAndUpdate(shopId, {
            $inc: { 
                "rating.count": 1,
                [starKey]: 1
            }
        });

        // Re-calculate average rating (simplified for now, can be done more precisely with aggregation)
        const updatedShop = await Shop.findById(shopId).lean();
        const stats = updatedShop.ratingStats || {};
        const totalPoints = (stats.star5*5) + (stats.star4*4) + (stats.star3*3) + (stats.star2*2) + (stats.star1*1);
        const totalCount = (stats.star5 + stats.star4 + stats.star3 + stats.star2 + stats.star1) || 1;
        
        await Shop.findByIdAndUpdate(shopId, {
            "rating.average": totalPoints / totalCount
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

        const [reviews, totalReviews, shop] = await Promise.all([
            ShopReview.find(filter)
                .populate("userId", "fullName email avatar")
                .sort(sortOptions[sort] || sortOptions.recent)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            ShopReview.countDocuments(filter),
            Shop.findById(shopId).select("rating ratingStats").lean()
        ]);

        return {
            reviews: reviews.map(shapeReview),
            stats: {
                averageRating: shop?.rating?.average || 0,
                totalReviews: shop?.rating?.count || totalReviews,
                ratingBreakdown: {
                    5: shop?.ratingStats?.star5 || 0,
                    4: shop?.ratingStats?.star4 || 0,
                    3: shop?.ratingStats?.star3 || 0,
                    2: shop?.ratingStats?.star2 || 0,
                    1: shop?.ratingStats?.star1 || 0,
                }
            },
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

    static async getVendorMyReviews(vendorId, query) {
        const { default: Shop } = await import("../shop/shop.model.js");
        const shop = await Shop.findOne({ vendor: vendorId });
        if (!shop) throw new ApiError(404, "Shop not found");

        return this.getShopReviews(shop._id, query);
    }
    static async adminGetAllReviews(query) {
        const { page, limit, status } = query;
        const filter = status ? { status } : {};

        const [reviews, totalReviews] = await Promise.all([
            ShopReview.find(filter)
                .populate("userId", "fullName email avatar")
                .populate("shopId", "shopname shopCode")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            ShopReview.countDocuments(filter),
        ]);

        return {
            reviews: reviews.map(shapeReview),
            totalReviews,
            totalPages: Math.ceil(totalReviews / limit),
            currentPage: page,
        };
    }

    static async adminUpdateStatus(reviewId, status) {
        const review = await ShopReview.findByIdAndUpdate(
            reviewId,
            { status },
            { returnDocument: 'after' }
        ).populate("userId", "fullName email avatar");

        if (!review) throw new ApiError(404, "Review not found.");

        // Optionally, recalculate shop ratings if needed, but they are generally incremental.
        // If status changes to 'inactive' we should probably decrement the shop rating, but that's complex.
        // For simplicity, we just return the review.

        return shapeReview(review);
    }
}

export default ShopReviewService;
