import mongoose from "mongoose";
import ShopReview from "./shop-review.model.js";
import Shop from "../shop/shop.model.js";
import OrderItem from "../orders/order-item.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";
import asyncHandler from "../../shared/utils/asyncHandler.js";
import ApiError from "../../shared/utils/ApiError.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

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

/**
 * @desc    Add a review for a shop
 * @route   POST /api/v1/shop-reviews/add
 * @access  Private
 */
export const addShopReview = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { shopId, rating, title, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(shopId)) throw new ApiError(400, "Invalid shop ID.");
    if (!rating || !comment) throw new ApiError(400, "Rating and comment are required.");
    
    if (rating < 1 || rating > 5) throw new ApiError(400, "Rating must be between 1 and 5.");
    if (comment.length < 10) throw new ApiError(400, "Comment must be at least 10 characters.");

    const shop = await Shop.findById(shopId).lean();
    if (!shop) throw new ApiError(404, "Shop not found.");

    // Prevent duplicate reviews
    const existing = await ShopReview.findOne({ shopId, userId });
    if (existing) throw new ApiError(409, "You have already reviewed this shop.");

    // Check for verified purchase
    const hasPurchased = await OrderItem.findOne({ 
        user_id: userId, 
        vendor: shop.vendor, 
        itemStatus: 'delivered' 
    }).lean();

    const imageArray = [];
    if (req.files?.length > 0) {
        for (const file of req.files.slice(0, 5)) {
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

    res.status(201).json(
        new ApiResponse(201, shapeReview(review), "Review submitted successfully.")
    );
});

/**
 * @desc    Get all reviews for a shop
 * @route   GET /api/v1/shop-reviews/shop/:shopId
 * @access  Public
 */
export const getShopReviews = asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const sort = req.query.sort || "recent";

    if (!mongoose.Types.ObjectId.isValid(shopId)) throw new ApiError(400, "Invalid shop ID.");

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

    res.status(200).json(
        new ApiResponse(200, {
            reviews: reviews.map(shapeReview),
            pagination: {
                totalReviews,
                totalPages: Math.ceil(totalReviews / limit),
                currentPage: page,
            }
        }, "Reviews fetched successfully.")
    );
});

/**
 * @desc    Update shop review
 * @route   PATCH /api/v1/shop-reviews/:reviewId
 * @access  Private (Owner)
 */
export const updateShopReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const userId = req.user._id;
    const { rating, title, comment } = req.body;

    const review = await ShopReview.findOne({ _id: reviewId, userId });
    if (!review) throw new ApiError(404, "Review not found or access denied.");

    if (rating) review.rating = rating;
    if (title) review.title = sanitise(title);
    if (comment) review.comment = sanitise(comment);
    review.isEdited = true;

    await review.save();
    await review.populate("userId", "fullName email avatar");

    res.status(200).json(
        new ApiResponse(200, shapeReview(review), "Review updated successfully.")
    );
});

/**
 * @desc    Delete shop review
 * @route   DELETE /api/v1/shop-reviews/:reviewId
 * @access  Private (Owner/Admin)
 */
export const deleteShopReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    const query = isAdmin ? { _id: reviewId } : { _id: reviewId, userId };
    const review = await ShopReview.findOne(query);
    
    if (!review) throw new ApiError(404, "Review not found.");

    // Cleanup images
    for (const img of review.images) {
        if (img.public_id) await deleteFromCloudinary(img.public_id).catch(() => {});
    }

    await ShopReview.findByIdAndDelete(review._id);

    res.status(200).json(
        new ApiResponse(200, null, "Review deleted successfully.")
    );
});

/**
 * @desc    Vendor response to shop review
 * @route   PATCH /api/v1/shop-reviews/vendor/:reviewId/respond
 * @access  Private (Vendor)
 */
export const vendorRespondToShopReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { response } = req.body;
    const vendorId = req.user._id;

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

    res.status(200).json(
        new ApiResponse(200, shapeReview(review), "Response added successfully.")
    );
});

/**
 * @desc    Mark shop review as helpful
 * @route   POST /api/v1/shop-reviews/:reviewId/helpful
 * @access  Private
 */
export const markHelpful = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;

    const review = await ShopReview.findByIdAndUpdate(
        reviewId,
        { $inc: { helpfulVotes: 1 } },
        { new: true }
    );

    if (!review) throw new ApiError(404, "Review not found.");

    res.status(200).json(
        new ApiResponse(200, { helpfulVotes: review.helpfulVotes }, "Marked as helpful.")
    );
});
