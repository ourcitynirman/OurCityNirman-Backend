import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import TeamService from "./team.service.js";
import {
    getMembersQuerySchema,
    idParamSchema,
    createMemberSchema,
    updateMemberSchema,
    reorderMembersSchema,
} from "./team.validation.js";

/**
 * @desc    Get all active team members for the homepage
 * @route   GET /api/v1/team/members
 * @access  Public
 */
export const getActiveMembers = asyncHandler(async (req, res) => {
    const members = await TeamService.getActiveMembers();
    return res.status(200).json(new ApiResponse(200, members, "Active team members fetched successfully"));
});

/**
 * @desc    Get list of all team members (including inactive)
 * @route   GET /api/v1/team/admin/members
 * @access  Private (Admin)
 */
export const getAllMembers = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getMembersQuerySchema.parse(req.query);
        const result = await TeamService.getAllMembers(queryData);
        return res.status(200).json(new ApiResponse(200, result, "All team members fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get team member performance and inventory statistics
 * @route   GET /api/v1/team/admin/members/stats
 * @access  Private (Admin)
 */
export const getMemberStats = asyncHandler(async (req, res) => {
    const stats = await TeamService.getMemberStats();
    return res.status(200).json(new ApiResponse(200, stats, "Team member statistics fetched successfully"));
});

/**
 * @desc    Get details of a specific team member
 * @route   GET /api/v1/team/admin/members/:id
 * @access  Private (Admin)
 */
export const getMemberById = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const member = await TeamService.getMemberById(id);
        return res.status(200).json(new ApiResponse(200, member, "Team member details fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Create a new team member
 * @route   POST /api/v1/team/admin/members
 * @access  Private (Admin)
 */
export const createMember = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = createMemberSchema.parse(req.body);
        const member = await TeamService.createMember(validatedData, req.files, req.user);
        return res.status(201).json(new ApiResponse(201, member, "Team member created successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Update team member details or replace image
 * @route   PUT /api/v1/team/admin/members/:id
 * @access  Private (Admin)
 */
export const updateMember = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const validatedData = updateMemberSchema.parse(req.body);
        const member = await TeamService.updateMember(id, validatedData, req.files, req.user);
        return res.status(200).json(new ApiResponse(200, member, "Team member updated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Toggle team member active/inactive status
 * @route   PATCH /api/v1/team/admin/members/:id/toggle
 * @access  Private (Admin)
 */
export const toggleMemberStatus = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const member = await TeamService.toggleMemberStatus(id, req.user);
        return res.status(200).json(new ApiResponse(200, { _id: member._id, isActive: member.isActive }, `Team member ${member.isActive ? "activated" : "deactivated"} successfully`));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Reorder team members sequence
 * @route   PATCH /api/v1/team/admin/members/reorder
 * @access  Private (Admin)
 */
export const reorderMembers = asyncHandler(async (req, res, next) => {
    try {
        const { members } = reorderMembersSchema.parse(req.body);
        await TeamService.reorderMembers(members);
        return res.status(200).json(new ApiResponse(200, null, `${members.length} member(s) reordered successfully`));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Soft delete (deactivate) a team member
 * @route   DELETE /api/v1/team/admin/members/:id
 * @access  Private (Admin)
 */
export const deleteMember = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const member = await TeamService.deleteMember(id, req.user);
        return res.status(200).json(new ApiResponse(200, { _id: member._id, isActive: member.isActive }, "Team member deactivated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Permanently delete a team member
 * @route   DELETE /api/v1/team/admin/members/:id/permanent
 * @access  Private (Admin)
 */
export const permanentDeleteMember = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        await TeamService.permanentDeleteMember(id);
        return res.status(200).json(new ApiResponse(200, { _id: id }, "Team member permanently deleted"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});
