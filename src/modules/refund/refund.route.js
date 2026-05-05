import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middlewares/auth.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import {
    processRefund,
    getRefundDetails
} from './refund.controller.js';

const RefundRouter = Router();

// All refund routes require authentication
RefundRouter.use(authenticate);

/**
 * @route   POST /api/v1/refunds/:orderId
 * @desc    Process a refund for an order (Admin Only)
 */
RefundRouter.post(
    '/:orderId',
    authorize(ROLES.ADMIN),
    processRefund
);

/**
 * @route   GET /api/v1/refunds/:orderId
 * @desc    Get refund details for an order (Admin or Owner)
 */
RefundRouter.get(
    '/:orderId',
    authorize(ROLES.ADMIN, ROLES.USER),
    getRefundDetails
);

export default RefundRouter;
