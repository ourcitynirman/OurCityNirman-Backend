import express from 'express';
import rateLimit from 'express-rate-limit';

import {
    getActiveSlides,
    getAllSlides,
    getSlideById, 
    getSlideStats,
    createSlide,
    updateSlide,
    toggleSlideStatus,
    reorderSlides,
    bulkUpdateSlides,
    deleteSlide,
    permanentDeleteSlide,
} from "./homeslider.controller.js";

import { authorize, verifyJWT } from "../../shared/middlewares/auth.middleware.js";
import { upload } from "../../shared/middlewares/multer.middleware.js";

const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests' },
    validate: { xForwardedForHeader: false },
});

const adminWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { success: false, message: 'Too many write requests' },
    validate: { xForwardedForHeader: false },
});

const imageUpload = upload.fields([{ name: "image", maxCount: 1 }]);

const SliderRoute = express.Router();

// =============================================================================
//                              PUBLIC ROUTES
// =============================================================================

/**
 * @desc    Fetch all active and ordered slider slides for the homepage
 * @route   GET /api/v1/slider/slides
 * @access  Public
 */
SliderRoute.get('/slides', publicLimiter, getActiveSlides);


// =============================================================================
//                              ADMIN MANAGEMENT
// =============================================================================

// Apply administrative restrictions for all management routes
SliderRoute.use(verifyJWT, authorize('admin'));

/**
 * @desc    Update the display sequence (order) of homepage slides
 * @route   PATCH /api/v1/slider/admin/slides/reorder
 * @access  Private (Admin)
 */
SliderRoute.patch('/admin/slides/reorder', reorderSlides);

/**
 * @desc    Bulk update slide properties (status, display duration, etc.)
 * @route   PATCH /api/v1/slider/admin/slides/bulk-update
 * @access  Private (Admin)
 */
SliderRoute.patch('/admin/slides/bulk-update', bulkUpdateSlides);

/**
 * @desc    Get detailed slider inventory and performance statistics
 * @route   GET /api/v1/slider/admin/slides/stats
 * @access  Private (Admin)
 */
SliderRoute.get('/admin/slides/stats', getSlideStats);

/**
 * @desc    Get comprehensive list of all slides (Active & Inactive)
 * @route   GET /api/v1/slider/admin/slides
 * @access  Private (Admin)
 */
SliderRoute.get('/admin/slides', getAllSlides);

/**
 * @desc    Create a new homepage slider with image upload
 * @route   POST /api/v1/slider/admin/slides
 * @access  Private (Admin)
 */
SliderRoute.post('/admin/slides', adminWriteLimiter, imageUpload, createSlide);

/**
 * @desc    Retrieve full details for a specific homepage slide
 * @route   GET /api/v1/slider/admin/slides/:id
 * @access  Private (Admin)
 */
SliderRoute.get('/admin/slides/:id', getSlideById);

/**
 * @desc    Update slide metadata or replace the slider image
 * @route   PUT /api/v1/slider/admin/slides/:id
 * @access  Private (Admin)
 */
SliderRoute.put('/admin/slides/:id', imageUpload, updateSlide);

/**
 * @desc    Soft delete a slide (move to inactive)
 * @route   DELETE /api/v1/slider/admin/slides/:id
 * @access  Private (Admin)
 */
SliderRoute.delete('/admin/slides/:id', deleteSlide);

/**
 * @desc    Toggle a slide's visibility status (Active/Inactive)
 * @route   PATCH /api/v1/slider/admin/slides/:id/toggle
 * @access  Private (Admin)
 */
SliderRoute.patch('/admin/slides/:id/toggle', toggleSlideStatus);

/**
 * @desc    Permanently delete a slide and purge its Cloudinary assets
 * @route   DELETE /api/v1/slider/admin/slides/:id/permanent
 * @access  Private (Admin)
 */
SliderRoute.delete('/admin/slides/:id/permanent', permanentDeleteSlide);

export default SliderRoute;