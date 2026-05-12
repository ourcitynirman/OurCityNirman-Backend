import { asyncHandler } from '../../shared/utils/api.utils.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { ApiResponse } from '../../shared/utils/api.utils.js';
import RefundService from './refund.service.js';
import { processRefundSchema, orderIdParamSchema } from './refund.validation.js';

/**
 * @desc    Process refund for an order via Razorpay
 * @route   POST /api/v1/refunds/:orderId
 * @access  Private (Admin)
 */
export const processRefund = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = orderIdParamSchema.parse(req.params);
        const validatedData = processRefundSchema.parse(req.body);
        const result = await RefundService.processRefund(orderId, validatedData);

        return res.status(200).json(new ApiResponse(200, result, 'Refund processed successfully via Razorpay'));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get refund details for an order
 * @route   GET /api/v1/refunds/:orderId
 * @access  Private (Owner/Admin)
 */
export const getRefundDetails = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = orderIdParamSchema.parse(req.params);
        const result = await RefundService.getRefundDetails(orderId);
        return res.status(200).json(new ApiResponse(200, result, 'Refund details fetched successfully'));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    List all refunds (Admin)
 * @route   GET /api/v1/refunds
 * @access  Private (Admin)
 */
export const listRefunds = asyncHandler(async (req, res) => {
    const result = await RefundService.listRefunds(req.query);
    return res.status(200).json(new ApiResponse(200, result, 'Refunds listed successfully'));
});
