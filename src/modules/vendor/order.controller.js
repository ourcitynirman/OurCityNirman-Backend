import { asyncHandler } from '../../shared/utils/api.utils.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { ApiResponse } from '../../shared/utils/api.utils.js';
import VendorService from './vendor.service.js';
import { vendorOrderQuerySchema, orderIdParamSchema, updateVendorOrderStatusSchema } from './vendor.validation.js';

/**
 * @desc    Get all orders containing products from the current vendor
 * @route   GET /api/v1/vendor/orders/
 * @access  Private (Vendor)
 */
export const getVendorOrders = asyncHandler(async (req, res, next) => {
    try {
        const queryData = vendorOrderQuerySchema.parse(req.query);
        const result = await VendorService.getVendorOrders(req.user._id, queryData);
        return res.status(200).json(new ApiResponse(200, result, "Vendor orders fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get full details of a specific order for the vendor
 * @route   GET /api/v1/vendor/orders/:id
 * @access  Private (Vendor)
 */
export const getVendorOrder = asyncHandler(async (req, res, next) => {
    try {
        const { id } = orderIdParamSchema.parse(req.params);
        const order = await VendorService.getVendorOrder(id, req.user._id);
        return res.status(200).json(new ApiResponse(200, { order }, "Vendor order fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Update order status for vendor items
 * @route   PATCH /api/v1/vendor/orders/:id/status
 * @access  Private (Vendor)
 */
export const updateOrderStatus = asyncHandler(async (req, res, next) => {
    try {
        const { id } = orderIdParamSchema.parse(req.params);
        const { status, note } = updateVendorOrderStatusSchema.parse(req.body);
        
        if (status === 'delivered' && !req.otpVerified) {
            throw new ApiError(403, 'OTP verification required to mark order as delivered');
        }

        const order = await VendorService.updateOrderStatus(id, req.user._id, status, note);
        return res.status(200).json(new ApiResponse(200, { order }, `Order status updated to ${status}`));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});