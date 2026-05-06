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

import { loginLimiter, otpLimiter, passwordResetLimiter } from "../../shared/middlewares/rateLimiter.middleware.js";
import { verifyJWT } from "../../shared/middlewares/auth.middleware.js";
import { upload } from "../../shared/middlewares/multer.middleware.js";

const router = Router();

// =============================================================================
//                              PUBLIC ROUTES
// =============================================================================

/**
 * @desc    Register a new user account and initiate OTP verification
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
router.post("/register", registerUser);

/**
 * @desc    Verify the 6-digit OTP sent to email to activate the account
 * @route   POST /api/v1/auth/verify
 * @access  Public
 */
router.post("/verify", verifyRegistrationOTP);

/**
 * @desc    Request a new registration OTP if the previous one expired
 * @route   POST /api/v1/auth/resend
 * @access  Public (Rate Limited)
 */
router.post("/resend", otpLimiter, resendRegistrationOTP);

/**
 * @desc    Authenticate user and receive access & refresh tokens
 * @route   POST /api/v1/auth/login
 * @access  Public (Rate Limited)
 */
router.post("/login", loginLimiter, loginUser);

/**
 * @desc    Refresh access token using a valid refresh token cookie
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public (JWT Refresh)
 */
router.post("/refresh-token", refreshAccessToken);

/**
 * @desc    Initiate password recovery flow by sending a reset link via email
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public (Rate Limited)
 */
router.post("/forgot-password", passwordResetLimiter, forgotPassword);

/**
 * @desc    Reset user password using a verified token from email
 * @route   POST /api/v1/auth/reset-password/:token
 * @access  Public
 */
router.post("/reset-password/:token", resetPassword);

// =============================================================================
//                              PRIVATE ROUTES
// =============================================================================

/**
 * @desc    Invalidate refresh token and clear session cookies
 * @route   POST /api/v1/auth/logout
 * @access  Private (JWT)
 */
router.post("/logout", verifyJWT, logoutUser);

/**
 * @desc    Retrieve detailed profile information for the logged-in user
 * @route   GET /api/v1/auth/current-user
 * @access  Private (JWT)
 */
router.get("/current-user", verifyJWT, getCurrentUser);

/**
 * @desc    Convenience alias for fetching current user profile
 * @route   GET /api/v1/auth/me
 * @access  Private (JWT)
 */
router.get("/me", verifyJWT, getCurrentUser);

/**
 * @desc    Change account password for an authenticated session
 * @route   POST /api/v1/auth/change-password
 * @access  Private (JWT)
 */
router.post("/change-password", verifyJWT, changePassword);

/**
 * @desc    Update profile metadata and upload new avatar image
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