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

} from "../controllers/user.controller.js";


import { loginLimiter } from "../middlewares/rateLimiter.midleware.js";
import { authenticate, verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();





// New Registration Flow (OTP-First)
router.post("/register", registerUser);
router.post("/verify", verifyRegistrationOTP);
router.post("/resend", resendRegistrationOTP);
router.post("/login", loginLimiter, loginUser);

// Logout user and clear tokens
router.post("/logout", verifyJWT, logoutUser);

// Refresh access token using refresh token
router.post("/refresh-token", refreshAccessToken);

// current logged in user details
router.get("/current-user", verifyJWT, getCurrentUser);

// Password management
router.post("/forgot-password", forgotPassword);

// Reset password using token from email
router.post("/reset-password/:token", resetPassword);



// Protected routes
router.post("/logout", verifyJWT, logoutUser);

// Get current logged in user details
router.get("/me", verifyJWT, getCurrentUser);

// Change password for authenticated users
router.post("/change-password", verifyJWT, changePassword);








export default router;