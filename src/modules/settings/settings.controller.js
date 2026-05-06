import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import SettingsService from "./settings.service.js";
import { updateSettingsSchema, userIdParamSchema, adminUpdateSettingsSchema } from "./settings.validation.js";

/**
 * @desc    Get current user's settings
 * @route   GET /api/v1/settings/me
 * @access  Private (Vendor)
 */
export const getMySettings = asyncHandler(async (req, res) => {
    const settings = await SettingsService.getMySettings(req.user);
    return res.status(200).json(new ApiResponse(200, settings, "Settings fetched successfully"));
});

/**
 * @desc    Update current user's settings
 * @route   PATCH /api/v1/settings/me
 * @access  Private (Vendor)
 */
export const updateMySettings = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = updateSettingsSchema.parse(req.body);
        const settings = await SettingsService.updateMySettings(req.user._id, req.user.role, validatedData);
        return res.status(200).json(new ApiResponse(200, settings, "Settings updated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get settings by user ID (Admin)
 * @route   GET /api/v1/settings/user/:userId
 * @access  Private (Admin)
 */
export const getSettingsByUserId = asyncHandler(async (req, res, next) => {
    try {
        const { userId } = userIdParamSchema.parse(req.params);
        const settings = await SettingsService.getSettingsByUserId(userId);
        return res.status(200).json(new ApiResponse(200, settings, "User settings fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Admin update user's settings
 * @route   PATCH /api/v1/settings/user/:userId
 * @access  Private (Admin)
 */
export const adminUpdateSettings = asyncHandler(async (req, res, next) => {
    try {
        const { userId } = userIdParamSchema.parse(req.params);
        const validatedData = adminUpdateSettingsSchema.parse(req.body);
        const settings = await SettingsService.adminUpdateSettings(userId, validatedData);
        return res.status(200).json(new ApiResponse(200, settings, "Settings updated by admin"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});