import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from '../../shared/utils/api.utils.js';
import OrderService from "./order.service.js";
import { 
    placeOrderSchema, 
    orderQuerySchema, 
    orderIdParamSchema, 
    orderItemTrackParamSchema, 
    cancelOrderSchema, 
    updateOrderStatusSchema, 
    verifyDeliveryOTPSchema, 
    updateItemTrackingSchema, 
    adminOrderQuerySchema, 
    adminCancelOrderSchema 
} from "./order.validation.js";

/**
 * @desc    Place a new order from cart
 * @route   POST /api/v1/orders/
 * @access  Private
 */
export const placeOrder = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = placeOrderSchema.parse(req.body);
        const result = await OrderService.placeOrder(validatedData, req.user);

        return res.status(201).json(new ApiResponse(201, result, "Order placed successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Get currently logged-in user's orders
 * @route   GET /api/v1/orders/
 * @access  Private
 */
export const getMyOrders = asyncHandler(async (req, res, next) => {
    try {
        const queryData = orderQuerySchema.parse(req.query);
        const result = await OrderService.getMyOrders(req.user._id, queryData);

        return res.status(200).json(new ApiResponse(200, result, "Orders fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Get full details of a specific order
 * @route   GET /api/v1/orders/:orderId
 * @access  Private
 */
export const getOrderById = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = orderIdParamSchema.parse(req.params);
        const order = await OrderService.getOrderById(orderId, req.user);

        return res.status(200).json(new ApiResponse(200, order, "Order details fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Get tracking timeline and history for an order
 * @route   GET /api/v1/orders/:orderId/history
 * @access  Private
 */
export const getOrderHistory = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = orderIdParamSchema.parse(req.params);
        const history = await OrderService.getOrderHistory(orderId, req.user);

        return res.status(200).json(new ApiResponse(200, history, "Order history fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Cancel an order (User initiated)
 * @route   PATCH /api/v1/orders/:orderId/cancel
 * @access  Private
 */
export const cancelOrder = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = orderIdParamSchema.parse(req.params);
        const { reason } = cancelOrderSchema.parse(req.body);
        const order = await OrderService.cancelOrder(orderId, reason, req.user);

        return res.status(200).json(new ApiResponse(200, order, "Order cancelled successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Update status of an order (Vendor limited access)
 * @route   PATCH /api/v1/orders/:orderId/status
 * @access  Private (Vendor)
 */
export const updateOrderStatus = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = orderIdParamSchema.parse(req.params);
        const { status, note } = updateOrderStatusSchema.parse(req.body);
        const order = await OrderService.updateOrderStatus(orderId, status, note, req.user);

        return res.status(200).json(new ApiResponse(200, order, `Order status updated to ${status}`));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Verify delivery OTP and mark order as delivered
 * @route   POST /api/v1/orders/:orderId/verify-delivery-otp
 * @access  Private (Vendor/Admin)
 */
export const verifyDeliveryOrder = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = orderIdParamSchema.parse(req.params);
        const { otp } = verifyDeliveryOTPSchema.parse(req.body);
        const result = await OrderService.verifyDeliveryOrder(orderId, otp, req.user);

        return res.status(200).json(new ApiResponse(200, result, "Delivery verified successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Get all orders containing products from the current vendor
 * @route   GET /api/v1/orders/vendor/my-orders
 * @access  Private (Vendor)
 */
export const getVendorOrders = asyncHandler(async (req, res, next) => {
    try {
        const result = await OrderService.getVendorOrders(req.query, req.user);
        return res.status(200).json(new ApiResponse(200, result, "Vendor orders fetched successfully"));
    } catch (err) {
        next(err);
    }
});

/**
 * @desc    Update tracking information for a specific order item
 * @route   PATCH /api/v1/orders/:orderId/items/:itemId/track
 * @access  Private (Vendor)
 */
export const updateItemTracking = asyncHandler(async (req, res, next) => {
    try {
        const { orderId, itemId } = orderItemTrackParamSchema.parse(req.params);
        const validatedData = updateItemTrackingSchema.parse(req.body);
        const item = await OrderService.updateItemTracking(orderId, itemId, validatedData, req.user);

        return res.status(200).json(new ApiResponse(200, item, "Item tracking updated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Get all platform orders with advanced filters
 * @route   GET /api/v1/orders/admin/all
 * @access  Private (Admin)
 */
export const adminGetAllOrders = asyncHandler(async (req, res, next) => {
    try {
        const queryData = adminOrderQuerySchema.parse(req.query);
        const result = await OrderService.adminGetAllOrders(queryData);

        return res.status(200).json(new ApiResponse(200, result, "All orders fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Cancel an order (Admin override)
 * @route   PATCH /api/v1/orders/:orderId/admin-cancel
 * @access  Private (Admin)
 */
export const adminCancelOrder = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = orderIdParamSchema.parse(req.params);
        const { reason } = adminCancelOrderSchema.parse(req.body);
        const order = await OrderService.adminCancelOrder(orderId, reason, req.user);

        return res.status(200).json(new ApiResponse(200, order, "Order cancelled by admin"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Update order status (Admin override)
 * @route   PATCH /api/v1/orders/:orderId/admin-status
 * @access  Private (Admin)
 */
export const adminUpdateOrderStatus = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = orderIdParamSchema.parse(req.params);
        const { status, note } = updateOrderStatusSchema.parse(req.body);
        const order = await OrderService.adminUpdateOrderStatus(orderId, status, note);

        return res.status(200).json(new ApiResponse(200, order, `Order status updated to ${status}`));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});