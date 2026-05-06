import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import ReviewService from "./review.service.js";
import { 
    addReviewSchema, 
    updateReviewSchema, 
    reviewIdParamSchema, 
    productIdParamSchema, 
    getProductReviewsQuerySchema, 
    getMyReviewsQuerySchema, 
    adminGetAllReviewsQuerySchema, 
    adminUpdateStatusSchema, 
    vendorResponseSchema 
} from "./review.validation.js";

/**
 * @desc    Create a new product review
 * @route   POST /api/v1/reviews/add
 * @access  Private
 */
export const addReview = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = addReviewSchema.parse(req.body);
        const review = await ReviewService.addReview(validatedData, req.user, req.files);

        return res.status(201).json(new ApiResponse(201, review, "Review submitted successfully."));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Update an existing review
 * @route   PUT /api/v1/reviews/:reviewId
 * @access  Private/Owner/Admin
 */
export const updateReview = asyncHandler(async (req, res, next) => {
    try {
        const { reviewId } = reviewIdParamSchema.parse(req.params);
        const validatedData = updateReviewSchema.parse(req.body);
        const review = await ReviewService.updateReview(reviewId, validatedData, req.user, req.files);

        return res.status(200).json(new ApiResponse(200, review, "Review updated successfully."));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Delete a review
 * @route   DELETE /api/v1/reviews/:reviewId
 * @access  Private/Owner/Admin
 */
export const deleteReview = asyncHandler(async (req, res, next) => {
    try {
        const { reviewId } = reviewIdParamSchema.parse(req.params);
        await ReviewService.deleteReview(reviewId, req.user);

        return res.status(200).json(new ApiResponse(200, null, "Review deleted successfully."));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get all reviews for a specific product
 * @route   GET /api/v1/reviews/product/:productId
 * @access  Public
 */
export const getProductReviews = asyncHandler(async (req, res, next) => {
    try {
        const { productId } = productIdParamSchema.parse(req.params);
        const queryData = getProductReviewsQuerySchema.parse(req.query);
        const result = await ReviewService.getProductReviews(productId, queryData);

        return res.status(200).json(new ApiResponse(200, result, "Product reviews fetched successfully."));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get current user's reviews
 * @route   GET /api/v1/reviews/my-reviews
 * @access  Private
 */
export const getMyReviews = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getMyReviewsQuerySchema.parse(req.query);
        const result = await ReviewService.getMyReviews(req.user._id, queryData);

        return res.status(200).json(new ApiResponse(200, result, "My reviews fetched successfully."));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Increment helpful vote count for a review
 * @route   POST /api/v1/reviews/:reviewId/helpful
 * @access  Private
 */
export const markHelpful = asyncHandler(async (req, res, next) => {
    try {
        const { reviewId } = reviewIdParamSchema.parse(req.params);
        const helpfulVotes = await ReviewService.markHelpful(reviewId);

        return res.status(200).json(new ApiResponse(200, { helpfulVotes }, "Marked as helpful."));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get all reviews for administration
 * @route   GET /api/v1/reviews/admin/all
 * @access  Private/Admin
 */
export const adminGetAllReviews = asyncHandler(async (req, res, next) => {
    try {
        const queryData = adminGetAllReviewsQuerySchema.parse(req.query);
        const result = await ReviewService.adminGetAllReviews(queryData);

        return res.status(200).json(new ApiResponse(200, result, "All reviews fetched successfully."));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Update review status (active, hidden, flagged)
 * @route   PATCH /api/v1/reviews/admin/:reviewId/status
 * @access  Private/Admin
 */
export const adminUpdateStatus = asyncHandler(async (req, res, next) => {
    try {
        const { reviewId } = reviewIdParamSchema.parse(req.params);
        const { status } = adminUpdateStatusSchema.parse(req.body);
        const review = await ReviewService.adminUpdateStatus(reviewId, status);

        return res.status(200).json(new ApiResponse(200, review, `Review status updated to ${status}`));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get all reviews for products belonging to the current vendor
 * @route   GET /api/v1/reviews/vendor/my-reviews
 * @access  Private/Vendor
 */
export const getVendorReviews = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getMyReviewsQuerySchema.parse(req.query);
        const result = await ReviewService.getVendorReviews(req.user._id, queryData);

        return res.status(200).json(new ApiResponse(200, result, "Vendor reviews fetched successfully."));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Allow vendor to respond to a review
 * @route   PATCH /api/v1/reviews/vendor/:reviewId/respond
 * @access  Private/Vendor
 */
export const vendorRespondToReview = asyncHandler(async (req, res, next) => {
    try {
        const { reviewId } = reviewIdParamSchema.parse(req.params);
        const { response } = vendorResponseSchema.parse(req.body);
        const review = await ReviewService.vendorRespondToReview(reviewId, response, req.user._id);

        return res.status(200).json(new ApiResponse(200, review, "Response added successfully."));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});
