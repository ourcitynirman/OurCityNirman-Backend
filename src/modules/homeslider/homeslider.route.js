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
} from "./Homeslider.controller.js";

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

/**
 * @desc    Get all active slider images for the homepage
 * @route   GET /api/v1/slider/slides
 * @access  Public
 */
SliderRoute.get('/slides', publicLimiter, getActiveSlides);

/**
 * @desc    Reorder slides sequence
 * @route   PATCH /api/v1/slider/admin/slides/reorder
 * @access  Private (Admin)
 */
SliderRoute.patch('/admin/slides/reorder', verifyJWT, authorize('admin'), reorderSlides);

/**
 * @desc    Bulk update multiple slides (status, duration, etc.)
 * @route   PATCH /api/v1/slider/admin/slides/bulk-update
 * @access  Private (Admin)
 */
SliderRoute.patch('/admin/slides/bulk-update', verifyJWT, authorize('admin'), bulkUpdateSlides);

/**
 * @desc    Get slider performance and inventory statistics
 * @route   GET /api/v1/slider/admin/slides/stats
 * @access  Private (Admin)
 */
SliderRoute.get('/admin/slides/stats', verifyJWT, authorize('admin'), getSlideStats);

/**
 * @desc    Get list of all slides (including inactive)
 * @route   GET /api/v1/slider/admin/slides
 * @access  Private (Admin)
 */
SliderRoute.get('/admin/slides', verifyJWT, authorize('admin'), getAllSlides);

/**
 * @desc    Create a new homepage slider
 * @route   POST /api/v1/slider/admin/slides
 * @access  Private (Admin)
 */
SliderRoute.post('/admin/slides', verifyJWT, authorize('admin'), adminWriteLimiter, imageUpload, createSlide);

/**
 * @desc    Get details of a specific slide
 * @route   GET /api/v1/slider/admin/slides/:id
 * @access  Private (Admin)
 */
SliderRoute.get('/admin/slides/:id', verifyJWT, authorize('admin'), getSlideById);

/**
 * @desc    Update slide details or replace image
 * @route   PUT /api/v1/slider/admin/slides/:id
 * @access  Private (Admin)
 */
SliderRoute.put('/admin/slides/:id', verifyJWT, authorize('admin'), imageUpload, updateSlide);

/**
 * @desc    Soft delete (deactivate) a slide
 * @route   DELETE /api/v1/slider/admin/slides/:id
 * @access  Private (Admin)
 */
SliderRoute.delete('/admin/slides/:id', verifyJWT, authorize('admin'), deleteSlide);

/**
 * @desc    Toggle slide active/inactive status
 * @route   PATCH /api/v1/slider/admin/slides/:id/toggle
 * @access  Private (Admin)
 */
SliderRoute.patch('/admin/slides/:id/toggle', verifyJWT, authorize('admin'), toggleSlideStatus);

/**
 * @desc    Permanently delete a slide and its Cloudinary assets
 * @route   DELETE /api/v1/slider/admin/slides/:id/permanent
 * @access  Private (Admin)
 */
SliderRoute.delete('/admin/slides/:id/permanent', verifyJWT, authorize('admin'), permanentDeleteSlide);

export default SliderRoute;