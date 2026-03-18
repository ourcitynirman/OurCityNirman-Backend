import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

import {
    createRazorpayOrder,
    verifyRazorpayPayment,
} from '../../controllers/razorpay/razorpay.controller.js';

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
} from '../../controllers/order/order.controller.js';

const OrderRouter = Router();

OrderRouter.post('/create-razorpay-order', authenticate, authorize('user'), createRazorpayOrder);
OrderRouter.post('/verify-payment',        authenticate, authorize('user'), verifyRazorpayPayment);

OrderRouter.get(
    '/vendor/my-orders',
    authenticate,
    authorize('vendor'),
    getVendorOrders
);

OrderRouter.patch(
    '/:orderId/status',
    authenticate,
    authorize('vendor'),
    updateOrderStatus          
);

OrderRouter.patch(
    '/:orderId/items/:itemId/track',
    authenticate,
    authorize('vendor'),
    updateItemTracking
);

OrderRouter.get(
    '/admin/all',
    authenticate,
    authorize('admin'),
    adminGetAllOrders         
);

OrderRouter.patch(
    '/:orderId/admin-cancel',
    authenticate,
    authorize('admin'),
    adminCancelOrder
);

OrderRouter.patch(
    '/:orderId/admin-status',
    authenticate,
    authorize('admin'),
    adminUpdateOrderStatus      
);

OrderRouter.post(
    '/',
    authenticate,
    authorize('user'),
    placeOrder                  
);

OrderRouter.get(
    '/',
    authenticate,
    authorize('user'),
    getMyOrders
);

OrderRouter.get(
    '/:orderId/history',
    authenticate,
    authorize('user', 'vendor', 'admin'),
    getOrderHistory
);

OrderRouter.get(
    '/:orderId',
    authenticate,
    authorize('user', 'vendor', 'admin'),
    getOrderById
);

OrderRouter.patch(
    '/:orderId/cancel',
    authenticate,
    authorize('user'),
    cancelOrder                 
);

export default OrderRouter;