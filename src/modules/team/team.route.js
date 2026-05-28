import express from 'express';
import rateLimit from 'express-rate-limit';

import {
    getActiveMembers,
    getAllMembers,
    getMemberById, 
    getMemberStats,
    createMember,
    updateMember,
    toggleMemberStatus,
    reorderMembers,
    deleteMember,
    permanentDeleteMember,
} from "./team.controller.js";

// Authentication (verifyJWT) and authorization (authorize) middlewares
import { authorize, verifyJWT } from "../../shared/middlewares/auth.middleware.js";
// Multer middleware to handle profile photo file uploads
import { upload } from "../../shared/middlewares/multer.middleware.js";

// Rate limiter for public endpoints to prevent DDoS (max 100 requests per 15 minutes)
const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests. Please try again later.' },
    validate: { xForwardedForHeader: false },
});

// Rate limiter for admin write operations to prevent abuse (max 50 requests per 15 minutes)
const adminWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { success: false, message: 'Too many write requests. Please try again later.' },
    validate: { xForwardedForHeader: false },
});

// Configure Multer upload fields to accept a single file with field name "image"
const imageUpload = upload.fields([{ name: "image", maxCount: 1 }]);

const TeamRoute = express.Router();

// =============================================================================
//                             1. PUBLIC ROUTES
// =============================================================================

/**
 * @route   GET /api/v1/team/members
 * @access  Public
 * @desc    Fetches all active team members sorted by their custom display order.
 *          This is a public endpoint used to render team profiles on the homepage and about page.
 */
TeamRoute.get('/members', publicLimiter, getActiveMembers);


// =============================================================================
//                             2. ADMIN MANAGEMENT ROUTES
// =============================================================================

// Require JWT verification and Admin role validation for all administrative endpoints below
TeamRoute.use(verifyJWT, authorize('admin'));

/**
 * @route   PATCH /api/v1/team/admin/members/reorder
 * @access  Private (Admin Only)
 * @desc    Updates the display order (sequence) of multiple team members.
 *          This controls the layout position of the cards on the frontend.
 */
TeamRoute.patch('/admin/members/reorder', reorderMembers);

/**
 * @route   GET /api/v1/team/admin/members/stats
 * @access  Private (Admin Only)
 * @desc    Retrieves a metrics summary for team members (total count, active count, inactive count)
 *          to render progress indicators in the admin panel.
 */
TeamRoute.get('/admin/members/stats', getMemberStats);

/**
 * @route   GET /api/v1/team/admin/members
 * @access  Private (Admin Only)
 * @desc    Retrieves the complete list of all team members (both active and inactive) 
 *          to display on the admin control panel dashboard.
 */
TeamRoute.get('/admin/members', getAllMembers);

/**
 * @route   POST /api/v1/team/admin/members
 * @access  Private (Admin Only)
 * @desc    Creates a new team member. Accepts text metadata and handles multipart profile photo uploads.
 */
TeamRoute.post('/admin/members', adminWriteLimiter, imageUpload, createMember);

/**
 * @route   GET /api/v1/team/admin/members/:id
 * @access  Private (Admin Only)
 * @desc    Retrieves the detailed record of a specific team member by their database ID.
 */
TeamRoute.get('/admin/members/:id', getMemberById);

/**
 * @route   PUT /api/v1/team/admin/members/:id
 * @access  Private (Admin Only)
 * @desc    Updates an existing team member's metadata or profile photo by their ID.
 */
TeamRoute.put('/admin/members/:id', imageUpload, updateMember);

/**
 * @route   DELETE /api/v1/team/admin/members/:id
 * @access  Private (Admin Only)
 * @desc    Soft-deletes/deactivates a team member. Sets their status to inactive so they hide on
 *          the public website but remain fully accessible on the admin dashboard.
 */
TeamRoute.delete('/admin/members/:id', deleteMember);

/**
 * @route   PATCH /api/v1/team/admin/members/:id/toggle
 * @access  Private (Admin Only)
 * @desc    Toggles a team member's active visibility status. Shows or hides them on public pages.
 */
TeamRoute.patch('/admin/members/:id/toggle', toggleMemberStatus);

/**
 * @route   DELETE /api/v1/team/admin/members/:id/permanent
 * @access  Private (Admin Only)
 * @desc    Permanently deletes a team member from the database and purges their photo from Cloudinary.
 */
TeamRoute.delete('/admin/members/:id/permanent', permanentDeleteMember);

export default TeamRoute;
