import { Router } from 'express';
import { getVendorDashboardStats, getInventoryReport } from './vendor.controller.js';
import VendorOrderrouter from './order.route.js';
import { authenticate, authorize, requireVerification } from '../../shared/middlewares/auth.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

const router = Router();

// Middleware for all vendor routes
router.use(authenticate);
router.use(authorize(ROLES.VENDOR));
router.use(requireVerification);

// Dashboard Stats
/**
 * @desc    Get real-time business statistics for the vendor dashboard
 * @route   GET /api/v1/vendor/dashboard/stats
 * @access  Private (Vendor)
 */
router.get('/dashboard/stats', getVendorDashboardStats);

// Inventory Analytics
/**
 * @desc    Get comprehensive inventory status and low-stock reports
 * @route   GET /api/v1/vendor/inventory/report
 * @access  Private (Vendor)
 */
router.get('/inventory/report', getInventoryReport);

// Re-export orders under /orders
/**
 * @desc    Sub-router for vendor-specific order management
 * @route   USE /api/v1/vendor/orders
 * @access  Private (Vendor)
 */
router.use('/orders', VendorOrderrouter);

export default router;
