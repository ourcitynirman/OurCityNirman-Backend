import { Router } from "express";
import { verifyJWT } from "../../shared/middlewares/auth.middleware.js";
import {
    toggleFollow,
    checkFollowStatus,
    getFollowedShops
} from "./shop-follower.controller.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// Toggle follow for a shop
router.post("/:shopId", toggleFollow);

// Check if user follows a shop
router.get("/:shopId/status", checkFollowStatus);

// Get user's followed shops
router.get("/", getFollowedShops);

export default router;
