import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import ShopReviewService from "./shop-review.service.js";
import { 
    addShopReviewSchema, 
    getShopReviewsQuerySchema, 
    reviewIdParamSchema, 
    shopIdParamSchema, 
    updateShopReviewSchema, 
    vendorResponseSchema 
} from "./shop-review.validation.js";

/**
 * @desc    Add a review for a shop
 * @route   POST /api/v1/shop-reviews/add
 * @access  Private
 */
export const addShopReview = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = addShopReviewSchema.parse(req.body);
        const review = await ShopReviewService.addShopReview(validatedData, req.user, req.files);

        return res.status(201).json(
            new ApiResponse(201, review, "Review submitted successfully.")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Get all reviews for a shop
 * @route   GET /api/v1/shop-reviews/shop/:shopId
 * @access  Public
 */
export const getShopReviews = asyncHandler(async (req, res, next) => {
    try {
        const { shopId } = shopIdParamSchema.parse(req.params);
        const queryData = getShopReviewsQuerySchema.parse(req.query);
        const result = await ShopReviewService.getShopReviews(shopId, queryData);

        return res.status(200).json(
            new ApiResponse(200, result, "Reviews fetched successfully.")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Update shop review
 * @route   PATCH /api/v1/shop-reviews/:reviewId
 * @access  Private (Owner)
 */
export const updateShopReview = asyncHandler(async (req, res, next) => {
    try {
        const { reviewId } = reviewIdParamSchema.parse(req.params);
        const validatedData = updateShopReviewSchema.parse(req.body);
        const review = await ShopReviewService.updateShopReview(reviewId, validatedData, req.user);

        return res.status(200).json(
            new ApiResponse(200, review, "Review updated successfully.")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Delete shop review
 * @route   DELETE /api/v1/shop-reviews/:reviewId
 * @access  Private (Owner/Admin)
 */
export const deleteShopReview = asyncHandler(async (req, res, next) => {
    try {
        const { reviewId } = reviewIdParamSchema.parse(req.params);
        await ShopReviewService.deleteShopReview(reviewId, req.user);

        return res.status(200).json(
            new ApiResponse(200, null, "Review deleted successfully.")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Vendor response to shop review
 * @route   PATCH /api/v1/shop-reviews/vendor/:reviewId/respond
 * @access  Private (Vendor)
 */
export const vendorRespondToShopReview = asyncHandler(async (req, res, next) => {
    try {
        const { reviewId } = reviewIdParamSchema.parse(req.params);
        const { response } = vendorResponseSchema.parse(req.body);
        const review = await ShopReviewService.vendorRespondToShopReview(reviewId, response, req.user);

        return res.status(200).json(
            new ApiResponse(200, review, "Response added successfully.")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Mark shop review as helpful
 * @route   POST /api/v1/shop-reviews/:reviewId/helpful
 * @access  Private
 */
export const markHelpful = asyncHandler(async (req, res, next) => {
    try {
        const { reviewId } = reviewIdParamSchema.parse(req.params);
        const helpfulVotes = await ShopReviewService.markHelpful(reviewId);

        return res.status(200).json(
            new ApiResponse(200, { helpfulVotes }, "Marked as helpful.")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});
/**
 * @desc    Get all reviews for the current vendor's shop
 * @route   GET /api/v1/shop-reviews/vendor/my-reviews
 * @access  Private (Vendor)
 */
export const getVendorMyReviews = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getShopReviewsQuerySchema.parse(req.query);
        const result = await ShopReviewService.getVendorMyReviews(req.user._id, queryData);

        return res.status(200).json(
            new ApiResponse(200, result, "Vendor reviews fetched successfully.")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Get all shop reviews for Admin
 * @route   GET /api/v1/shop-reviews/admin/all
 * @access  Private (Admin)
 */
export const getAdminShopReviews = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getShopReviewsQuerySchema.parse(req.query);
        const result = await ShopReviewService.adminGetAllReviews(queryData);

        return res.status(200).json(
            new ApiResponse(200, result, "Admin shop reviews fetched successfully.")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Update shop review status (Admin)
 * @route   PATCH /api/v1/shop-reviews/admin/:reviewId/status
 * @access  Private (Admin)
 */
export const updateAdminShopReviewStatus = asyncHandler(async (req, res, next) => {
    try {
        const { reviewId } = reviewIdParamSchema.parse(req.params);
        const { status } = req.body;
        
        if (!['active', 'inactive', 'flagged'].includes(status)) {
            return next(new ApiError('Invalid status value.', 400));
        }
        
        const review = await ShopReviewService.adminUpdateStatus(reviewId, status);

        return res.status(200).json(
            new ApiResponse(200, review, "Review status updated successfully.")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});
