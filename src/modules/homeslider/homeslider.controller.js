import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import HomeSliderService from "./homeslider.service.js";
import { 
    getSlidesQuerySchema, 
    idParamSchema, 
    createSlideSchema, 
    updateSlideSchema, 
    reorderSlidesSchema, 
    bulkUpdateSlidesSchema 
} from "./homeslider.validation.js";

/**
 * @desc    Get all active slider images for the homepage
 * @route   GET /api/v1/slider/slides
 * @access  Public
 */
export const getActiveSlides = asyncHandler(async (req, res) => {
    const slides = await HomeSliderService.getActiveSlides();
    return res.status(200).json(new ApiResponse(200, slides, "Active slides fetched successfully"));
});

/**
 * @desc    Get list of all slides (including inactive)
 * @route   GET /api/v1/slider/admin/slides
 * @access  Private (Admin)
 */
export const getAllSlides = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getSlidesQuerySchema.parse(req.query);
        const result = await HomeSliderService.getAllSlides(queryData);
        return res.status(200).json(new ApiResponse(200, result, "All slides fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get slider performance and inventory statistics
 * @route   GET /api/v1/slider/admin/slides/stats
 * @access  Private (Admin)
 */
export const getSlideStats = asyncHandler(async (req, res) => {
    const stats = await HomeSliderService.getSlideStats();
    return res.status(200).json(new ApiResponse(200, stats, "Slide statistics fetched successfully"));
});

/**
 * @desc    Get details of a specific slide
 * @route   GET /api/v1/slider/admin/slides/:id
 * @access  Private (Admin)
 */
export const getSlideById = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const slide = await HomeSliderService.getSlideById(id);
        return res.status(200).json(new ApiResponse(200, slide, "Slide details fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Create a new homepage slider
 * @route   POST /api/v1/slider/admin/slides
 * @access  Private (Admin)
 */
export const createSlide = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = createSlideSchema.parse(req.body);
        const slide = await HomeSliderService.createSlide(validatedData, req.files, req.user);
        return res.status(201).json(new ApiResponse(201, slide, "Slide created successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Update slide details or replace image
 * @route   PUT /api/v1/slider/admin/slides/:id
 * @access  Private (Admin)
 */
export const updateSlide = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const validatedData = updateSlideSchema.parse(req.body);
        const slide = await HomeSliderService.updateSlide(id, validatedData, req.files, req.user);
        return res.status(200).json(new ApiResponse(200, slide, "Slide updated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Toggle slide active/inactive status
 * @route   PATCH /api/v1/slider/admin/slides/:id/toggle
 * @access  Private (Admin)
 */
export const toggleSlideStatus = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const slide = await HomeSliderService.toggleSlideStatus(id, req.user);
        return res.status(200).json(new ApiResponse(200, { _id: slide._id, isActive: slide.isActive }, `Slide ${slide.isActive ? "activated" : "deactivated"} successfully`));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Reorder slides sequence
 * @route   PATCH /api/v1/slider/admin/slides/reorder
 * @access  Private (Admin)
 */
export const reorderSlides = asyncHandler(async (req, res, next) => {
    try {
        const { slides } = reorderSlidesSchema.parse(req.body);
        await HomeSliderService.reorderSlides(slides);
        return res.status(200).json(new ApiResponse(200, null, `${slides.length} slide(s) reordered successfully`));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Bulk update multiple slides
 * @route   PATCH /api/v1/slider/admin/slides/bulk-update
 * @access  Private (Admin)
 */
export const bulkUpdateSlides = asyncHandler(async (req, res, next) => {
    try {
        const { slideIds, updates } = bulkUpdateSlidesSchema.parse(req.body);
        const result = await HomeSliderService.bulkUpdateSlides(slideIds, updates, req.user);
        return res.status(200).json(new ApiResponse(200, { modifiedCount: result.modifiedCount }, `${result.modifiedCount} slide(s) updated successfully`));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Soft delete (deactivate) a slide
 * @route   DELETE /api/v1/slider/admin/slides/:id
 * @access  Private (Admin)
 */
export const deleteSlide = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const slide = await HomeSliderService.deleteSlide(id, req.user);
        return res.status(200).json(new ApiResponse(200, { _id: slide._id, isActive: slide.isActive }, "Slide deactivated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Permanently delete a slide
 * @route   DELETE /api/v1/slider/admin/slides/:id/permanent
 * @access  Private (Admin)
 */
export const permanentDeleteSlide = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        await HomeSliderService.permanentDeleteSlide(id);
        return res.status(200).json(new ApiResponse(200, { _id: id }, "Slide permanently deleted"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});