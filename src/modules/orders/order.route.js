import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middlewares/auth.middleware.js';


import {
    placeOrder,
    getMyOrders,
    getOrderById,
    cancelOrder,
    updateOrderStatus,
    adminUpdateOrderStatus,
    getOrderHistory,
    getVendorOrders,
    updateItemTracking,
    adminGetAllOrders,
    adminCancelOrder,
    verifyDeliveryOrder,
} from './order.controller.js';
import { ALL_ROLES, ROLES } from '../../shared/constants/roles.js';

const OrderRouter = Router();


// --- VENDOR ORDER MANAGEMENT ---

/**
 * @desc    Get all orders containing products from the current vendor
 * @route   GET /api/v1/orders/vendor/my-orders
 * @access  Private (Vendor)
 */
OrderRouter.get(
    '/vendor/my-orders',
    authenticate,
    authorize(ROLES.VENDOR),
    getVendorOrders
);

/**
 * @desc    Update status of an order (Vendor limited access)
 * @route   PATCH /api/v1/orders/:orderId/status
 * @access  Private (Vendor)
 */
OrderRouter.patch(
    '/:orderId/status',
    authenticate,
    authorize(ROLES.VENDOR),
    updateOrderStatus
);

/**
 * @desc    Verify delivery OTP and mark order as delivered
 * @route   POST /api/v1/orders/:orderId/verify-delivery-otp
 * @access  Private (Vendor/Admin)
 */
OrderRouter.post(
    '/:orderId/verify-delivery-otp',
    authenticate,
    authorize(ROLES.VENDOR, ROLES.ADMIN),
    verifyDeliveryOrder
);

/**
 * @desc    Update tracking information for a specific order item
 * @route   PATCH /api/v1/orders/:orderId/items/:itemId/track
 * @access  Private (Vendor)
 */
OrderRouter.patch(
    '/:orderId/items/:itemId/track',
    authenticate,
    authorize(ROLES.VENDOR),
    updateItemTracking
);

// --- ADMIN ORDER MANAGEMENT ---

/**
 * @desc    Get all platform orders with advanced filters
 * @route   GET /api/v1/orders/admin/all
 * @access  Private (Admin)
 */
OrderRouter.get(
    '/admin/all',
    authenticate,
    authorize(ROLES.ADMIN),
    adminGetAllOrders
);

/**
 * @desc    Cancel an order (Admin override)
 * @route   PATCH /api/v1/orders/:orderId/admin-cancel
 * @access  Private (Admin)
 */
OrderRouter.patch(
    '/:orderId/admin-cancel',
    authenticate,
    authorize(ROLES.ADMIN),
    adminCancelOrder
);

/**
 * @desc    Update order status (Admin override)
 * @route   PATCH /api/v1/orders/:orderId/admin-status
 * @access  Private (Admin)
 */


OrderRouter.patch(
    '/:orderId/admin-status',
    authenticate,
    authorize(ROLES.ADMIN),
    adminUpdateOrderStatus
);



// --- USER ORDER MANAGEMENT ---

/**
 * @desc    Place a new order from cart
 * @route   POST /api/v1/orders/
 * @access  Private
 */


OrderRouter.post(
    '/',
    authenticate,
    authorize(...ALL_ROLES),
    placeOrder
);

/**
 * @desc    Get currently logged-in user's orders
 * @route   GET /api/v1/orders/
 * @access  Private
 */


OrderRouter.get(
    '/',
    authenticate,
    authorize(...ALL_ROLES),
    getMyOrders
);

/**
 * @desc    Get tracking timeline and history for an order
 * @route   GET /api/v1/orders/:orderId/history
 * @access  Private
 */

OrderRouter.get(
    '/:orderId/history',
    authenticate,
    authorize(...ALL_ROLES),
    getOrderHistory
);

/**
 * @desc    Get full details of a specific order
 * @route   GET /api/v1/orders/:orderId
 * @access  Private
 */

OrderRouter.get(
    '/:orderId',
    authenticate,
    authorize(...ALL_ROLES),
    getOrderById
);

/**
 * @desc    Cancel an order (User initiated)
 * @route   PATCH /api/v1/orders/:orderId/cancel
 * @access  Private
 */

OrderRouter.patch(
    '/:orderId/cancel',
    authenticate,
    authorize(...ALL_ROLES),
    cancelOrder
);

export default OrderRouter;