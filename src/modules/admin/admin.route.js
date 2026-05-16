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
    rejectProduct,
    updatePromotionalStatus,

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

// Apply administrative restrictions globally
AdminRouter.use(authenticate);
AdminRouter.use(authorize('admin'));

// =============================================================================
//                              DASHBOARD & REPORTS
// =============================================================================

/**
 * @desc    Get real-time platform overview statistics for the admin dashboard
 * @route   GET /api/v1/admin/stats
 * @access  Private (Admin)
 */
AdminRouter.get('/stats', getDashboardStats);

/**
 * @desc    Generate comprehensive financial reports and transaction summaries
 * @route   GET /api/v1/admin/reports/finance
 * @access  Private (Admin)
 */
AdminRouter.get('/reports/finance', getFinancialReport);

// =============================================================================
//                              USER MANAGEMENT
// =============================================================================

/**
 * @desc    Get paginated list of all platform users with advanced filters
 * @route   GET /api/v1/admin/users
 * @access  Private (Admin)
 */
AdminRouter.get('/users', getUsers);

/**
 * @desc    Get full profile details and activity for a specific user
 * @route   GET /api/v1/admin/users/:id
 * @access  Private (Admin)
 */
AdminRouter.get('/users/:id', getUserById);

/**
 * @desc    Toggle account access (Block/Unblock) for a specific user
 * @route   PATCH /api/v1/admin/users/:id/block
 * @access  Private (Admin)
 */
AdminRouter.patch('/users/:id/block', blockUnblockUser);

/**
 * @desc    Permanently delete a user account and purge related data
 * @route   DELETE /api/v1/admin/users/:id
 * @access  Private (Admin)
 */
AdminRouter.delete('/users/:id', deleteUser);

// =============================================================================
//                              VENDOR MANAGEMENT
// =============================================================================

/**
 * @desc    Get paginated list of all registered vendors and their status
 * @route   GET /api/v1/admin/vendors
 * @access  Private (Admin)
 */
AdminRouter.get('/vendors', getVendors);

/**
 * @desc    Verify vendor identity and shop documents to enable selling
 * @route   PATCH /api/v1/admin/vendors/:id/verify
 * @access  Private (Admin)
 */
AdminRouter.patch('/vendors/:id/verify', verifyVendor);

/**
 * @desc    Toggle platform access (Block/Unblock) for a vendor
 * @route   PATCH /api/v1/admin/vendors/:id/block
 * @access  Private (Admin)
 */
AdminRouter.patch('/vendors/:id/block', blockVendor);

// =============================================================================
//                              PRODUCT MODERATION
// =============================================================================

/**
 * @desc    Get list of all platform products for quality control and moderation
 * @route   GET /api/v1/admin/products
 * @access  Private (Admin)
 */
AdminRouter.get('/products', getAdminProducts);

/**
 * @desc    Approve a pending product listing for storefront visibility
 * @route   PATCH /api/v1/admin/products/:id/approve
 * @access  Private (Admin)
 */
AdminRouter.patch('/products/:id/approve', approveProduct);

/**
 * @desc    Bulk approve multiple pending product listings in one request
 * @route   PATCH /api/v1/admin/products/bulk-approve
 * @access  Private (Admin)
 */
AdminRouter.patch('/products/bulk-approve', bulkApproveProducts);

/**
 * @desc    Reject a product listing with a specific reason
 * @route   PATCH /api/v1/admin/products/:id/reject
 * @access  Private (Admin)
 */
AdminRouter.patch('/products/:id/reject', rejectProduct);

/**
 * @desc    Update promotional status (Featured, Trending, Popular)
 * @route   PATCH /api/v1/admin/products/:id/promotional
 * @access  Private (Admin)
 */
AdminRouter.patch('/products/:id/promotional', updatePromotionalStatus);

/**
 * @desc    Block a product listing due to policy violations or quality issues
 * @route   PATCH /api/v1/admin/products/:id/block
 * @access  Private (Admin)
 */
AdminRouter.patch('/products/:id/block', blockProduct);

// =============================================================================
//                              ORDER ADMINISTRATION
// =============================================================================

/**
 * @desc    Get global list of all orders across the platform
 * @route   GET /api/v1/admin/orders
 * @access  Private (Admin)
 */
AdminRouter.get('/orders', getAdminOrders);

/**
 * @desc    Get full lifecycle and tracking details for a specific order
 * @route   GET /api/v1/admin/orders/:id
 * @access  Private (Admin)
 */
AdminRouter.get('/orders/:id', getAdminOrderById);

/**
 * @desc    Override order lifecycle status manually (Emergency use)
 * @route   PATCH /api/v1/admin/orders/:id/status
 * @access  Private (Admin)
 */
AdminRouter.patch('/orders/:id/status', overrideOrderStatus);

export default AdminRouter;