import express from "express";
import {
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
} from "./review.controller.js";
import { verifyJWT, authorize } from "../../shared/middlewares/auth.middleware.js";
import { upload } from "../../shared/middlewares/multer.middleware.js";

const reviewRouter = express.Router();

// --- PUBLIC ROUTES ---

/**
 * @desc    Get all reviews for a specific product
 * @route   GET /api/v1/reviews/product/:productId
 * @access  Public
 */
reviewRouter.get("/product/:productId", getProductReviews);

// --- PROTECTED ROUTES (Requires Login) ---

/**
 * @desc    Get current user's reviews
 * @route   GET /api/v1/reviews/my-reviews
 * @access  Private
 */
reviewRouter.get("/my-reviews", verifyJWT, getMyReviews);

/**
 * @desc    Create a new product review
 * @route   POST /api/v1/reviews/add
 * @access  Private
 */
reviewRouter.post("/add", verifyJWT, upload.array("images", 5), addReview);

/**
 * @desc    Update an existing review
 * @route   PUT /api/v1/reviews/:reviewId
 * @access  Private/Owner/Admin
 */
reviewRouter.put("/:reviewId", verifyJWT, upload.array("images", 5), updateReview);

/**
 * @desc    Delete a review
 * @route   DELETE /api/v1/reviews/:reviewId
 * @access  Private/Owner/Admin
 */
reviewRouter.delete("/:reviewId", verifyJWT, deleteReview);

/**
 * @desc    Increment helpful vote count for a review
 * @route   POST /api/v1/reviews/:reviewId/helpful
 * @access  Private
 */
reviewRouter.post("/:reviewId/helpful", verifyJWT, markHelpful);

// --- VENDOR ROUTES ---

/**
 * @desc    Get all reviews for products belonging to the current vendor
 * @route   GET /api/v1/reviews/vendor/my-reviews
 * @access  Private/Vendor
 */
reviewRouter.get("/vendor/my-reviews", verifyJWT, authorize("vendor"), getVendorReviews);

/**
 * @desc    Allow vendor to respond to a review
 * @route   PATCH /api/v1/reviews/vendor/:reviewId/respond
 * @access  Private/Vendor
 */
reviewRouter.patch("/vendor/:reviewId/respond", verifyJWT, authorize("vendor"), vendorRespondToReview);

// --- ADMIN ROUTES ---

/**
 * @desc    Get all reviews for administration
 * @route   GET /api/v1/reviews/admin/all
 * @access  Private/Admin
 */
reviewRouter.get("/admin/all", verifyJWT, authorize("admin"), adminGetAllReviews);

/**
 * @desc    Update review status (active, hidden, flagged)
 * @route   PATCH /api/v1/reviews/admin/:reviewId/status
 * @access  Private/Admin
 */
reviewRouter.patch("/admin/:reviewId/status", verifyJWT, authorize("admin"), adminUpdateStatus);

export default reviewRouter;