import express from "express";
import rateLimit from "express-rate-limit";
import { authenticate, authorize } from "../../shared/middlewares/auth.middleware.js";
import { ROLES } from "../../shared/constants/roles.js";
import {
    getMySettings,
    updateMySettings,
    getSettingsByUserId,
    adminUpdateSettings,
} from "./settings.controller.js";

const router = express.Router();

const settingsUpdateLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             5,
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
        success: false,
        message: "Too many update requests. Please try again after 15 minutes.",
    },
});

// =============================================================================
//                              VENDOR SETTINGS
// =============================================================================

/**
 * @desc    Get account and notification preferences for the logged-in vendor
 * @route   GET /api/v1/settings/me
 * @access  Private (Vendor)
 */
router.get(
    "/me",
    authenticate,
    authorize(ROLES.VENDOR),        
    getMySettings
);

/**
 * @desc    Update account and notification preferences for the logged-in vendor
 * @route   PATCH /api/v1/settings/me
 * @access  Private (Vendor)
 */
router.patch(
    "/me",
    authenticate,
    authorize(ROLES.VENDOR),          
    settingsUpdateLimiter,
    updateMySettings
);


// =============================================================================
//                              ADMIN MANAGEMENT
// =============================================================================

/**
 * @desc    Get account and notification preferences for a specific user ID
 * @route   GET /api/v1/settings/:userId
 * @access  Private (Admin)
 */
router.get(
    "/:userId",
    authenticate,
    authorize(ROLES.ADMIN),
    getSettingsByUserId
);

/**
 * @desc    Force update account and notification preferences for a specific user
 * @route   PATCH /api/v1/settings/:userId
 * @access  Private (Admin)
 */
router.patch(
    "/:userId",
    authenticate,
    authorize(ROLES.ADMIN),
    adminUpdateSettings
);

export default router;