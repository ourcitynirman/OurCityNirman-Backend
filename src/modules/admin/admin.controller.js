import { asyncHandler } from '../../shared/utils/api.utils.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { ApiResponse } from '../../shared/utils/api.utils.js';
import AdminService from './admin.service.js';
import { 
    getUsersQuerySchema, 
    idParamSchema, 
    blockProductSchema, 
    getAdminOrdersQuerySchema, 
    overrideOrderStatusSchema, 
    getFinancialReportQuerySchema, 
    bulkApproveProductsSchema 
} from './admin.validation.js';

/**
 * @desc    Get list of all users
 */
export const getUsers = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getUsersQuerySchema.parse(req.query);
        const result = await AdminService.getUsers(queryData);
        return res.status(200).json(new ApiResponse(200, result, "Users fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Get user by ID
 */
export const getUserById = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const result = await AdminService.getUserById(id);
        return res.status(200).json(new ApiResponse(200, result, "User profile fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Block or unblock user
 */
export const blockUnblockUser = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const user = await AdminService.blockUnblockUser(id, req.user, req);
        return res.status(200).json(new ApiResponse(200, { userId: user._id, isActive: user.isActive }, `User ${user.isActive ? 'unblocked' : 'blocked'}`));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Delete user
 */
export const deleteUser = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        await AdminService.deleteUser(id, req.user, req);
        return res.status(200).json(new ApiResponse(200, { deletedId: id }, 'User deleted successfully'));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Get all vendors
 */
export const getVendors = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getUsersQuerySchema.parse(req.query);
        const result = await AdminService.getVendors(queryData);
        return res.status(200).json(new ApiResponse(200, result, "Vendors fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Verify vendor
 */
export const verifyVendor = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const user = await AdminService.verifyVendor(id, req);
        return res.status(200).json(new ApiResponse(200, { userId: user._id, isVerified: true }, 'Vendor verified'));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Block or unblock vendor
 */
export const blockVendor = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const user = await AdminService.blockVendor(id, req);
        return res.status(200).json(new ApiResponse(200, { userId: user._id, isActive: user.isActive }, `Vendor ${user.isActive ? 'unblocked' : 'blocked'}`));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Get all products (Admin)
 */
export const getAdminProducts = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getUsersQuerySchema.parse(req.query);
        const result = await AdminService.getAdminProducts(queryData);
        return res.status(200).json(new ApiResponse(200, result, "Products fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Approve product
 */
export const approveProduct = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const product = await AdminService.approveProduct(id, req);
        return res.status(200).json(new ApiResponse(200, { productId: product._id, isApproved: true }, 'Product approved'));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Bulk approve products
 */
export const bulkApproveProducts = asyncHandler(async (req, res, next) => {
    try {
        const { productIds } = bulkApproveProductsSchema.parse(req.body);
        const result = await AdminService.bulkApproveProducts(productIds, req);
        return res.status(200).json(new ApiResponse(200, result, "Bulk approval complete"));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Block product
 */
export const blockProduct = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const { reason } = blockProductSchema.parse(req.body);
        const product = await AdminService.blockProduct(id, reason, req);
        return res.status(200).json(new ApiResponse(200, { productId: product._id, isActive: false }, 'Product blocked'));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Get all orders (Admin)
 */
export const getAdminOrders = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getAdminOrdersQuerySchema.parse(req.query);
        const result = await AdminService.getAdminOrders(queryData);
        return res.status(200).json(new ApiResponse(200, result, "Orders fetched"));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Get order by ID (Admin)
 */
export const getAdminOrderById = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const order = await AdminService.getAdminOrderById(id);
        return res.status(200).json(new ApiResponse(200, { order }, "Order details fetched"));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Override order status
 */
export const overrideOrderStatus = asyncHandler(async (req, res, next) => {
    try {
        const { id } = idParamSchema.parse(req.params);
        const { status, note } = overrideOrderStatusSchema.parse(req.body);
        const order = await AdminService.overrideOrderStatus(id, status, note);
        return res.status(200).json(new ApiResponse(200, { order }, `Status changed to ${status}`));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});

/**
 * @desc    Get dashboard stats
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
    const stats = await AdminService.getDashboardStats();
    return res.status(200).json(new ApiResponse(200, stats, "Dashboard stats fetched"));
});

/**
 * @desc    Get financial report
 */
export const getFinancialReport = asyncHandler(async (req, res, next) => {
    try {
        const queryData = getFinancialReportQuerySchema.parse(req.query);
        const report = await AdminService.getFinancialReport(queryData);
        return res.status(200).json(new ApiResponse(200, report, "Financial report generated"));
    } catch (err) {
        if (err.name === 'ZodError') return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        next(err);
    }
});