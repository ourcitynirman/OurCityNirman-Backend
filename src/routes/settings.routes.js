import express from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize }    from "../middlewares/authorize.middleware.js";
import {
    getMySettings,
    updateMySettings,
    getSettingsByUserId,
    adminUpdateSettings,
} from "../controllers/settings.controller.js";

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



router.get(
    "/me",
    authenticate,
    authorize("vendor"),        
    getMySettings
);


router.patch(
    "/me",
    authenticate,
    authorize("vendor"),          
    settingsUpdateLimiter,
    updateMySettings
);



// GET  /settings/:userId
router.get(
    "/:userId",
    authenticate,
    authorize("admin"),
    getSettingsByUserId
);

// PATCH /settings/:userId
router.patch(
    "/:userId",
    authenticate,
    authorize("admin"),
    adminUpdateSettings
);

export default router;