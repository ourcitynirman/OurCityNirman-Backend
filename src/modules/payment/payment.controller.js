import { asyncHandler } from '../../shared/utils/api.utils.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { ApiResponse } from '../../shared/utils/api.utils.js';
import PaymentService from './payment.service.js';
import { createRazorpayOrderSchema, verifyRazorpayPaymentSchema } from './payment.validation.js';

/**
 * @desc    Create Razorpay Order
 * @route   POST /api/v1/payment/create
 * @access  Private
 */ 
export const createRazorpayOrder = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = createRazorpayOrderSchema.parse(req.body);
        const result = await PaymentService.createRazorpayOrder(validatedData, req.user);
        return res.status(200).json(new ApiResponse(200, result, "Razorpay order created successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + (err.errors || err.issues || []).map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Verify Razorpay Payment
 * @route   POST /api/v1/payment/verify
 * @access  Private
 */
export const verifyRazorpayPayment = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = verifyRazorpayPaymentSchema.parse(req.body);
        const result = await PaymentService.verifyRazorpayPayment(validatedData, req.user);
        return res.status(200).json(new ApiResponse(200, result, "Payment verified successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + (err.errors || err.issues || []).map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});