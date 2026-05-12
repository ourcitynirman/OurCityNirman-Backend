import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middlewares/auth.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import {
    processRefund,
    getRefundDetails,
    listRefunds
} from './refund.controller.js';

const RefundRouter = Router();

// Apply authentication to all refund routes
RefundRouter.use(authenticate);

/**
 * @desc    Process a refund for a delivered order via Razorpay API
 * @route   POST /api/v1/refunds/:orderId
 * @access  Private (Admin Only)
 */
RefundRouter.post(
    '/:orderId',
    authorize(ROLES.ADMIN),
    processRefund
);

/**
 * @desc    Retrieve detailed refund information for a specific order
 * @route   GET /api/v1/refunds/:orderId
 * @access  Private (Admin or Order Owner)
 */
RefundRouter.get(
    '/:orderId',
    authorize(ROLES.ADMIN, ROLES.USER),
    getRefundDetails
);

/**
 * @desc    List all refunds
 * @route   GET /api/v1/refunds
 * @access  Private (Admin Only)
 */
RefundRouter.get(
    '/',
    authorize(ROLES.ADMIN),
    listRefunds
);

export default RefundRouter;
