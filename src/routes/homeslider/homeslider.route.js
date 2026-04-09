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
} from "../../controllers/homeslider/Homeslider.controller.js";

import { authorize, verifyJWT } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/multer.middleware.js";

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

SliderRoute.get('/slides', publicLimiter, getActiveSlides);

SliderRoute.patch('/admin/slides/reorder', verifyJWT, authorize('admin'), reorderSlides);
SliderRoute.patch('/admin/slides/bulk-update', verifyJWT, authorize('admin'), bulkUpdateSlides);

SliderRoute.get('/admin/slides/stats', verifyJWT, authorize('admin'), getSlideStats);

SliderRoute.get('/admin/slides', verifyJWT, authorize('admin'), getAllSlides);
SliderRoute.post('/admin/slides', verifyJWT, authorize('admin'), adminWriteLimiter, imageUpload, createSlide);

SliderRoute.get('/admin/slides/:id', verifyJWT, authorize('admin'), getSlideById);
SliderRoute.put('/admin/slides/:id', verifyJWT, authorize('admin'), imageUpload, updateSlide);
SliderRoute.delete('/admin/slides/:id', verifyJWT, authorize('admin'), deleteSlide);

SliderRoute.patch('/admin/slides/:id/toggle', verifyJWT, authorize('admin'), toggleSlideStatus);
SliderRoute.delete('/admin/slides/:id/permanent', verifyJWT, authorize('admin'), permanentDeleteSlide);

export default SliderRoute;