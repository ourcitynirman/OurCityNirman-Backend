import { asyncHandler, ApiResponse } from "../../shared/utils/api.utils.js";
import VendorProfileService from "./vendor-profile.service.js";
import { createVendorProfileSchema, updateVendorProfileSchema } from "./vendor-profile.validation.js";

/**
 * @desc    Get current vendor's professional profile
 * @route   GET /api/v1/vendor-profile/my
 * @access  Private (Vendor)
 */
export const getMyProfile = asyncHandler(async (req, res) => {
    try {
        const profile = await VendorProfileService.getProfile(req.user._id);
        return res.status(200).json(new ApiResponse(200, profile, "Profile fetched successfully"));
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(200).json(new ApiResponse(200, null, "No profile found, please create one"));
        }
        throw error;
    }
});

/**
 * @desc    Create or update vendor's professional profile
 * @route   POST /api/v1/vendor-profile/upsert
 * @access  Private (Vendor)
 */
export const upsertProfile = asyncHandler(async (req, res) => {
    const validatedData = createVendorProfileSchema.parse(req.body);
    const profile = await VendorProfileService.createOrUpdateProfile(req.user._id, validatedData);
    return res.status(200).json(new ApiResponse(200, profile, "Profile saved successfully"));
});

/**
 * @desc    (Admin) Update vendor verification status
 * @route   PATCH /api/v1/vendor-profile/admin/:profileId/status
 * @access  Private (Admin)
 */
export const adminUpdateStatus = asyncHandler(async (req, res) => {
    const { profileId } = req.params;
    const { status, reason } = req.body;
    const profile = await VendorProfileService.adminUpdateStatus(profileId, status, reason);
    return res.status(200).json(new ApiResponse(200, profile, `Profile status updated to ${status}`));
});

/**
 * @desc    (Admin) Get all vendor profiles for moderation
 * @route   GET /api/v1/vendor-profile/admin/all
 * @access  Private (Admin)
 */
export const adminGetAllProfiles = asyncHandler(async (req, res) => {
    const result = await VendorProfileService.adminGetAllProfiles(req.query);
    return res.status(200).json(new ApiResponse(200, result, "Vendor profiles fetched successfully"));
});
