import { asyncHandler } from '../../shared/utils/api.utils.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { ApiResponse } from '../../shared/utils/api.utils.js';
import HSNService from './hsn.service.js';
import { createHSNSchema, getAllHSNQuerySchema, idParamSchema, updateHSNSchema, bulkInsertHSNSchema } from './hsn.validation.js';

/**
 * @desc    Create a new HSN record
 * @route   POST /api/v1/hsn
 * @access  Private (Admin)
 */
export const createHSN = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = createHSNSchema.parse(req.body);
        const hsn = await HSNService.createHSN(validatedData);
        return res.status(201).json(new ApiResponse(201, hsn, "HSN record created successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get all HSN records
 * @route   GET /api/v1/hsn
 * @access  Public
 */
export const getAllHSN = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getAllHSNQuerySchema.parse(req.query);
        const result = await HSNService.getAllHSN(queryData);
        return res.status(200).json(new ApiResponse(200, result, "HSN records fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get HSN by ID
 * @route   GET /api/v1/hsn/:id
 * @access  Public
 */
export const getHSNById = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const hsn = await HSNService.getHSNById(id);
        return res.status(200).json(new ApiResponse(200, hsn, "HSN record fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Update HSN record
 * @route   PUT /api/v1/hsn/:id
 * @access  Private (Admin)
 */
export const updateHSN = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const validatedData = updateHSNSchema.parse(req.body);
        const hsn = await HSNService.updateHSN(id, validatedData);
        return res.status(200).json(new ApiResponse(200, hsn, "HSN record updated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Soft delete HSN record
 * @route   DELETE /api/v1/hsn/:id
 * @access  Private (Admin)
 */
export const deleteHSN = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        await HSNService.deleteHSN(id);
        return res.status(200).json(new ApiResponse(200, null, "HSN record deactivated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Bulk insert HSN records
 * @route   POST /api/v1/hsn/bulk
 * @access  Private (Admin)
 */
export const bulkInsertHSN = asyncHandler(async (req, res, next) => {
    try {
        const { hsn_list } = bulkInsertHSNSchema.parse(req.body);
        const result = await HSNService.bulkInsertHSN(hsn_list);
        return res.status(201).json(new ApiResponse(201, result, `${result.length} HSN records inserted successfully`));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Toggle HSN active status
 * @route   PATCH /api/v1/hsn/:id/toggle-status
 * @access  Private (Admin)
 */
export const toggleHSNStatus = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const hsn = await HSNService.toggleHSNStatus(id);
        return res.status(200).json(new ApiResponse(200, hsn, `HSN record ${hsn.is_active ? 'activated' : 'deactivated'} successfully`));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});
