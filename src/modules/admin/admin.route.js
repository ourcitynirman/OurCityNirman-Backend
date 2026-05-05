import { Router } from 'express';
import {
    // Users
    getUsers,
    getUserById,
    blockUnblockUser,
    deleteUser,

    // Vendors
    getVendors,
    verifyVendor,
    blockVendor,

    // Products
    getAdminProducts,
    approveProduct,
    blockProduct,

    // Orders
    getAdminOrders,
    getAdminOrderById,
    overrideOrderStatus,

    // Dashboard
    getDashboardStats,
    getFinancialReport,
    bulkApproveProducts,
} from './admin.controller.js';

import { authenticate, authorize } from '../../shared/middlewares/auth.middleware.js';

const AdminRouter = Router();

AdminRouter.use(authenticate);
AdminRouter.use(authorize('admin'));

// --- DASHBOARD ---

/**
 * @desc    Get administrative dashboard statistics
 * @route   GET /api/v1/admin/stats
 * @access  Private (Admin)
 */
AdminRouter.get('/stats', getDashboardStats);

/**
 * @desc    Get detailed platform financial performance reports
 * @route   GET /api/v1/admin/reports/finance
 * @access  Private (Admin)
 */
AdminRouter.get('/reports/finance', getFinancialReport);

// --- USER MANAGEMENT ---

/**
 * @desc    Get list of all users with filters
 * @route   GET /api/v1/admin/users
 * @access  Private (Admin)
 */
AdminRouter.get('/users', getUsers);

/**
 * @desc    Get detailed user profile by ID
 * @route   GET /api/v1/admin/users/:id
 * @access  Private (Admin)
 */
AdminRouter.get('/users/:id', getUserById);

/**
 * @desc    Block or unblock a user account
 * @route   PATCH /api/v1/admin/users/:id/block
 * @access  Private (Admin)
 */
AdminRouter.patch('/users/:id/block', blockUnblockUser);

/**
 * @desc    Permanently delete a user account
 * @route   DELETE /api/v1/admin/users/:id
 * @access  Private (Admin)
 */
AdminRouter.delete('/users/:id', deleteUser);

// --- VENDOR MANAGEMENT ---

/**
 * @desc    Get list of all registered vendors
 * @route   GET /api/v1/admin/vendors
 * @access  Private (Admin)
 */
AdminRouter.get('/vendors', getVendors);

/**
 * @desc    Verify a vendor's account status
 * @route   PATCH /api/v1/admin/vendors/:id/verify
 * @access  Private (Admin)
 */
AdminRouter.patch('/vendors/:id/verify', verifyVendor);

/**
 * @desc    Block or unblock a vendor account
 * @route   PATCH /api/v1/admin/vendors/:id/block
 * @access  Private (Admin)
 */
AdminRouter.patch('/vendors/:id/block', blockVendor);

// --- PRODUCT MODERATION ---

/**
 * @desc    Get list of all products (for moderation)
 * @route   GET /api/v1/admin/products
 * @access  Private (Admin)
 */
AdminRouter.get('/products', getAdminProducts);

/**
 * @desc    Approve a pending product listing
 * @route   PATCH /api/v1/admin/products/:id/approve
 * @access  Private (Admin)
 */
AdminRouter.patch('/products/:id/approve', approveProduct);

/**
 * @desc    Approve multiple pending products in a single batch
 * @route   PATCH /api/v1/admin/products/bulk-approve
 * @access  Private (Admin)
 */
AdminRouter.patch('/products/bulk-approve', bulkApproveProducts);

/**
 * @desc    Block a product listing
 * @route   PATCH /api/v1/admin/products/:id/block
 * @access  Private (Admin)
 */
AdminRouter.patch('/products/:id/block', blockProduct);

// --- ORDER ADMINISTRATION ---

/**
 * @desc    Get list of all platform orders
 * @route   GET /api/v1/admin/orders
 * @access  Private (Admin)
 */
AdminRouter.get('/orders', getAdminOrders);

/**
 * @desc    Get full details of a specific order
 * @route   GET /api/v1/admin/orders/:id
 * @access  Private (Admin)
 */
AdminRouter.get('/orders/:id', getAdminOrderById);

/**
 * @desc    Override order status manually
 * @route   PATCH /api/v1/admin/orders/:id/status
 * @access  Private (Admin)
 */
AdminRouter.patch('/orders/:id/status', overrideOrderStatus);

export default AdminRouter;