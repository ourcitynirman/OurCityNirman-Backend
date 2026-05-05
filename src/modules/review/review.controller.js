
import mongoose from "mongoose";
import Review from "./review.model.js";
import Product from "../products/product.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";
import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ROLES } from "../../shared/constants/roles.js";

/**
 * @desc    Sanitise strings to prevent basic XSS or injection
 * @param   {string} str 
 * @returns {string}
 */
const sanitise = (str = "") =>
    String(str)
        .replace(/<[^>]*>/g, "")
        .replace(/[{}$]/g, "")
        .trim();

/**
 * @desc    Format review object for client consumption
 * @param   {object} review 
 * @returns {object}
 */
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

/**
 * @desc    Check if a string is a valid MongoDB ObjectId
 * @param   {string} id 
 * @returns {boolean}
 */
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * @desc    Create a new product review
 * @route   POST /api/v1/reviews/add
 * @access  Private
 */
const addReview = asyncHandler(async (req, res) => {
    const userId    = req.user._id;
    const productId = sanitise(req.body.productId ?? "");
    const comment   = sanitise(req.body.comment   ?? "");
    const title     = sanitise(req.body.title     ?? "");
    const rating    = Number(req.body.rating);

    if (!isValidId(productId)) throw new ApiError(400, "Invalid product ID.");
    if (!rating || !comment)   throw new ApiError(400, "Rating and comment are required.");
    
    if (isNaN(rating) || rating < 1 || rating > 5) {
        throw new ApiError(400, "Rating must be between 1 and 5.");
    }
    if (comment.length < 10) {
        throw new ApiError(400, "Comment must be at least 10 characters.");
    }
    if (comment.length > 1000) {
        throw new ApiError(400, "Comment cannot exceed 1000 characters.");
    }

    const product = await Product.findById(productId).lean();
    if (!product) throw new ApiError(404, "Product not found.");

    // Prevent duplicate reviews from the same user
    const existing = await Review.findOne({ productId, userId });
    if (existing) throw new ApiError(409, "You have already reviewed this product.");

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

    res.status(201).json({
        success : true,
        message : "Review submitted successfully.",
        data    : shapeReview(review),
    });
});

/**
 * @desc    Update an existing review
 * @route   PUT /api/v1/reviews/:reviewId
 * @access  Private/Owner/Admin
 */
const updateReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const userId  = req.user._id;
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isValidId(reviewId)) throw new ApiError(400, "Invalid review ID.");

    const comment = sanitise(req.body.comment ?? "");
    const title   = sanitise(req.body.title   ?? "");
    const rating  = req.body.rating ? Number(req.body.rating) : null;

    if (rating !== null && (isNaN(rating) || rating < 1 || rating > 5)) {
        throw new ApiError(400, "Rating must be between 1 and 5.");
    }
    if (comment && comment.length < 10) {
        throw new ApiError(400, "Comment must be at least 10 characters.");
    }
    if (comment && comment.length > 1000) {
        throw new ApiError(400, "Comment cannot exceed 1000 characters.");
    }

    const query  = isAdmin ? { _id: reviewId } : { _id: reviewId, userId };
    const review = await Review.findOne(query);

    if (!review) {
        throw new ApiError(404, "Review not found or permission denied.");
    }

    // Handle new images if provided
    if (req.files?.length > 0) {
        // Clean up old images
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

    res.status(200).json({
        success : true,
        message : "Review updated successfully.",
        data    : shapeReview(review),
    });
});

/**
 * @desc    Delete a review
 * @route   DELETE /api/v1/reviews/:reviewId
 * @access  Private/Owner/Admin
 */
const deleteReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const userId  = req.user._id;
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isValidId(reviewId)) throw new ApiError(400, "Invalid review ID.");

    const query  = isAdmin ? { _id: reviewId } : { _id: reviewId, userId };
    const review = await Review.findOneAndDelete(query);

    if (!review) {
        throw new ApiError(404, "Review not found or permission denied.");
    }

    // Cleanup images from cloud
    for (const img of review.images ?? []) {
        if (img.public_id) {
            await deleteFromCloudinary(img.public_id).catch((e) =>
                console.warn("[deleteReview] Image delete failed:", e.message)
            );
        }
    }

    // Remove from product's reviews array
    await Product.findByIdAndUpdate(review.productId, {
        $pull: { reviews: review._id },
    });

    res.status(200).json({ success: true, message: "Review deleted successfully." });
});

/**
 * @desc    Get all reviews for a specific product
 * @route   GET /api/v1/reviews/product/:productId
 * @access  Public
 */
const getProductReviews = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    if (!isValidId(productId)) throw new ApiError(400, "Invalid product ID.");

    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 10);
    const rating = parseInt(req.query.rating) || null;
    const sort   = req.query.sort || "recent";

    const product = await Product.findById(productId).lean();
    if (!product) throw new ApiError(404, "Product not found.");

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

    res.status(200).json({
        success     : true,
        data        : reviews.map(shapeReview),
        totalReviews,
        totalPages  : Math.ceil(totalReviews / limit),
        currentPage : page,
        distribution,
    });
});

/**
 * @desc    Get current user's reviews
 * @route   GET /api/v1/reviews/my-reviews
 * @access  Private
 */
const getMyReviews = asyncHandler(async (req, res) => {
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

    res.status(200).json({
        success     : true,
        data        : reviews.map(shapeReview),
        totalReviews,
        totalPages  : Math.ceil(totalReviews / limit),
        currentPage : page,
    });
});

/**
 * @desc    Increment helpful vote count for a review
 * @route   POST /api/v1/reviews/:reviewId/helpful
 * @access  Private
 */
const markHelpful = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    if (!isValidId(reviewId)) throw new ApiError(400, "Invalid review ID.");

    const review = await Review.findByIdAndUpdate(
        reviewId,
        { $inc: { helpfulVotes: 1 } },
        { returnDocument: 'after' }
    );

    if (!review) throw new ApiError(404, "Review not found.");

    res.status(200).json({
        success      : true,
        message      : "Marked as helpful.",
        helpfulVotes : review.helpfulVotes,
    });
});

/**
 * @desc    Get all reviews for administration
 * @route   GET /api/v1/reviews/admin/all
 * @access  Private/Admin
 */
const adminGetAllReviews = asyncHandler(async (req, res) => {
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

    res.status(200).json({
        success     : true,
        data        : reviews.map(shapeReview),
        totalReviews,
        totalPages  : Math.ceil(totalReviews / limit),
        currentPage : page,
    });
});

/**
 * @desc    Update review status (active, hidden, flagged)
 * @route   PATCH /api/v1/reviews/admin/:reviewId/status
 * @access  Private/Admin
 */
const adminUpdateStatus = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { status }   = req.body;

    if (!["active", "hidden", "flagged"].includes(status)) {
        throw new ApiError(400, "Invalid status. Use: active, hidden, flagged");
    }

    const review = await Review.findByIdAndUpdate(
        reviewId,
        { status },
        { returnDocument: 'after' }
    ).populate("userId", "name email avatar profilePhoto photo");

    if (!review) throw new ApiError(404, "Review not found.");

    // Recalculate product rating since status changed
    await Review.recalculateProductRating(review.productId);

    res.status(200).json({
        success : true,
        message : `Review status updated to "${status}".`,
        data    : shapeReview(review),
    });
});

/**
 * @desc    Get all reviews for products belonging to the current vendor
 * @route   GET /api/v1/reviews/vendor/my-reviews
 * @access  Private/Vendor
 */
const getVendorReviews = asyncHandler(async (req, res) => {
    const vendorId = req.user._id;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 10);

    // 1. Get all product IDs for this vendor
    const products = await Product.find({ vendorId }).select("_id").lean();
    const productIds = products.map(p => p._id);

    // 2. Find reviews for these products
    const [reviews, totalReviews] = await Promise.all([
        Review.find({ productId: { $in: productIds } })
            .populate("productId", "name images")
            .populate("userId",    "name email avatar profilePhoto photo")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Review.countDocuments({ productId: { $in: productIds } }),
    ]);

    res.status(200).json({
        success     : true,
        data        : reviews.map(shapeReview),
        totalReviews,
        totalPages  : Math.ceil(totalReviews / limit),
        currentPage : page,
    });
});

/**
 * @desc    Allow vendor to respond to a review
 * @route   PATCH /api/v1/reviews/vendor/:reviewId/respond
 * @access  Private/Vendor
 */
const vendorRespondToReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { response } = req.body;
    const vendorId = req.user._id;

    if (!response?.trim()) throw new ApiError(400, "Response comment is required.");
    if (!isValidId(reviewId)) throw new ApiError(400, "Invalid review ID.");

    const review = await Review.findById(reviewId).populate("productId", "vendorId");
    if (!review) throw new ApiError(404, "Review not found.");

    // Verify vendor owns the product being reviewed
    if (review.productId.vendorId.toString() !== vendorId.toString()) {
        throw new ApiError(403, "You can only respond to reviews for your own products.");
    }

    review.vendorResponse = {
        comment: sanitise(response),
        respondedAt: new Date()
    };

    await review.save();

    res.status(200).json({
        success : true,
        message : "Response added successfully.",
        data    : shapeReview(review)
    });
});

export {
    addReview,
    updateReview,
    deleteReview,
    getProductReviews,
    getMyReviews,
    markHelpful,
    adminGetAllReviews,
    adminUpdateStatus,
    getVendorReviews,
    vendorRespondToReview,
};
