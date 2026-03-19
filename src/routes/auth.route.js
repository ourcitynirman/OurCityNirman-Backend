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
} from "../controllers/user.controller.js";

import { loginLimiter } from "../middlewares/rateLimiter.midleware.js";
import { authenticate, verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.post("/register", registerUser);
router.post("/verify", verifyRegistrationOTP);
router.post("/resend", resendRegistrationOTP);
router.post("/login", loginLimiter, loginUser);

router.post("/logout", verifyJWT, logoutUser);

router.post("/refresh-token", refreshAccessToken);

router.get("/current-user", verifyJWT, getCurrentUser);
router.get("/me", verifyJWT, getCurrentUser);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

router.post("/change-password", verifyJWT, changePassword);

router.patch("/update-profile", verifyJWT, upload.single("profileImage"), updateUserProfile);

export default router;