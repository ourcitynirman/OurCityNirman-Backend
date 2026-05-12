import { Router } from "express";
import { verifyJWT, authorize } from "../../shared/middlewares/auth.middleware.js";
import { ROLES } from "../../shared/constants/roles.js";
import {
    getMyProfile,
    upsertProfile,
    adminUpdateStatus,
    adminGetAllProfiles
} from "./vendor-profile.controller.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// Vendor specific routes
router.get("/my", authorize(ROLES.VENDOR), getMyProfile);
router.post("/upsert", authorize(ROLES.VENDOR), upsertProfile);

// Admin specific routes
router.get("/admin/all", authorize(ROLES.ADMIN), adminGetAllProfiles);
router.patch("/admin/:profileId/status", authorize(ROLES.ADMIN), adminUpdateStatus);

export default router;
