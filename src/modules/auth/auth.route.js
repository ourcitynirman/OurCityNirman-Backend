import { Router } from "express";
import {
    registerUser,
    verifyRegistrationOTP,
    resendRegistrationOTP,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    changePassword,
    forgotPassword,
    resetPassword,
    updateUserProfile,
} from "./auth.controller.js";

import { loginLimiter } from "../../shared/middlewares/rateLimiter.middleware.js";
import { verifyJWT } from "../../shared/middlewares/auth.middleware.js";
import { upload } from "../../shared/middlewares/multer.middleware.js";

const router = Router();

// --- PUBLIC ROUTES ---

/**
 * @desc    Register a new user (initializes OTP verification flow)
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
router.post("/register", registerUser);

/**
 * @desc    Verify OTP sent during registration to activate account
 * @route   POST /api/v1/auth/verify
 * @access  Public
 */
router.post("/verify", verifyRegistrationOTP);

/**
 * @desc    Resend OTP for registration if not received or expired
 * @route   POST /api/v1/auth/resend
 * @access  Public
 */
router.post("/resend", resendRegistrationOTP);

/**
 * @desc    Authenticate user using email/phone and password
 * @route   POST /api/v1/auth/login
 * @access  Public (Rate Limited)
 */
router.post("/login", loginLimiter, loginUser);

/**
 * @desc    Generate a new access token using a valid refresh token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public (Requires refreshToken in cookies/body)
 */
router.post("/refresh-token", refreshAccessToken);

/**
 * @desc    Request a password reset link via email
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
router.post("/forgot-password", forgotPassword);

/**
 * @desc    Reset password using a valid reset token from email
 * @route   POST /api/v1/auth/reset-password/:token
 * @access  Public
 */
router.post("/reset-password/:token", resetPassword);

/**
 * =============================================================================
 *                              PRIVATE ROUTES (Authenticated)
 * =============================================================================
 */

/**
 * @desc    Revoke refresh token and clear auth cookies
 * @route   POST /api/v1/auth/logout
 * @access  Private (JWT)
 */
router.post("/logout", verifyJWT, logoutUser);

/**
 * @desc    Retrieve profile data for the authenticated user
 * @route   GET /api/v1/auth/current-user
 * @access  Private (JWT)
 */
router.get("/current-user", verifyJWT, getCurrentUser);

/**
 * @desc    Convenience alias for current-user
 * @route   GET /api/v1/auth/me
 * @access  Private (JWT)
 */
router.get("/me", verifyJWT, getCurrentUser);

/**
 * @desc    Update password for the logged-in user
 * @route   POST /api/v1/auth/change-password
 * @access  Private (JWT)
 */
router.post("/change-password", verifyJWT, changePassword);

/**
 * @desc    Update profile info and upload avatar image
 * @route   PATCH /api/v1/auth/update-profile
 * @access  Private (JWT)
 */
router.patch(
    "/update-profile", 
    verifyJWT, 
    upload.single("profileImage"), 
    updateUserProfile
);

export default router;