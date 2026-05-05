import { Router } from "express";
import {
    addShopReview,
    getShopReviews,
    updateShopReview,
    deleteShopReview,
    vendorRespondToShopReview,
    markHelpful
} from "./shop-review.controller.js";
import { authenticate, authorize } from "../../shared/middlewares/auth.middleware.js";
import { upload } from "../../shared/middlewares/multer.middleware.js";

const router = Router();

// --- PUBLIC ROUTES ---
/**
 * @desc    Get all reviews and rating stats for a specific shop
 * @route   GET /api/v1/shop-reviews/shop/:shopId
 * @access  Public
 */
router.get("/shop/:shopId", getShopReviews);

// --- PROTECTED ROUTES ---
router.use(authenticate);

/**
 * @desc    Add a new review for a shop (with optional image uploads)
 * @route   POST /api/v1/shop-reviews/add
 * @access  Private
 */
router.post("/add", upload.array("images", 5), addShopReview);

/**
 * @desc    Update an existing shop review (Owner only)
 * @route   PATCH /api/v1/shop-reviews/:reviewId
 * @access  Private (Owner)
 */
router.patch("/:reviewId", updateShopReview);

/**
 * @desc    Delete a shop review (Owner or Admin)
 * @route   DELETE /api/v1/shop-reviews/:reviewId
 * @access  Private (Owner/Admin)
 */
router.delete("/:reviewId", deleteShopReview);

/**
 * @desc    Increment the helpful vote count for a shop review
 * @route   POST /api/v1/shop-reviews/:reviewId/helpful
 * @access  Private
 */
router.post("/:reviewId/helpful", markHelpful);

// --- VENDOR ROUTES ---
/**
 * @desc    Allow vendor to respond to a customer review for their shop
 * @route   PATCH /api/v1/shop-reviews/vendor/:reviewId/respond
 * @access  Private (Vendor)
 */
router.patch("/vendor/:reviewId/respond", authorize("vendor"), vendorRespondToShopReview);

export default router;
