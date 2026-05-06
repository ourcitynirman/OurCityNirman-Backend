import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middlewares/auth.middleware.js';
import { ALL_ROLES } from '../../shared/constants/roles.js';
import {
    createRazorpayOrder,
    verifyRazorpayPayment,
} from './payment.controller.js';

const PaymentRouter = Router();

// Apply authentication to all payment routes
PaymentRouter.use(authenticate);

/**
 * @desc    Create a new Razorpay order for secure checkout processing
 * @route   POST /api/v1/payments/razorpay/create
 * @access  Private (All Roles)
 */
PaymentRouter.post('/razorpay/create', authorize(...ALL_ROLES), createRazorpayOrder);

/**
 * @desc    Verify Razorpay payment signature after successful transaction
 * @route   POST /api/v1/payments/razorpay/verify
 * @access  Private (All Roles)
 */
PaymentRouter.post('/razorpay/verify', authorize(...ALL_ROLES), verifyRazorpayPayment);

export default PaymentRouter;
