import { Router } from 'express';
import {
    getVendorOrders,
    getVendorOrder,
    updateOrderStatus,
} from './order.controller.js';
import {
    authenticate,
    authorize,
    requireVerification,
} from '../../shared/middlewares/auth.middleware.js';
import {
    sendDeliveryOTP,
    verifyDeliveryOTP,
} from '../../shared/services/Delivery.otp.service.js';
import Order from '../orders/order.model.js';
import ApiError from '../../shared/utils/ApiError.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';

const VendorOrderrouter = Router();


// Middlewares are handled by the parent router (vendor.route.js)


const requireDeliveryOtp = asyncHandler(async (req, res, next) => {
    if (req.body.status !== 'delivered') {
        req.otpVerified = false;
        return next();
    }

    try {
        const { otp } = req.body;
        const { id }  = req.params;

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'OTP is required to mark order as delivered',
            });
        }

      
        await verifyDeliveryOTP(id, otp);

        req.otpVerified = true;
        next();
    } catch (err) {
        next(err);
    }
});


function maskEmail(email) {
    if (!email) return '';
    const [local, domain] = email.split('@');
    const masked = local.slice(0, 2) + '**';
    return `${masked}@${domain}`;
}


/**
 * @desc    Get all orders containing products from the current vendor
 * @route   GET /api/v1/vendor/orders/
 * @access  Private (Vendor)
 */
VendorOrderrouter.get('/', getVendorOrders);

/**
 * @desc    Get full details of a specific order for the vendor
 * @route   GET /api/v1/vendor/orders/:id
 * @access  Private (Vendor)
 */
VendorOrderrouter.get('/:id', getVendorOrder);


/**
 * @desc    Send delivery confirmation OTP to customer
 * @route   POST /api/v1/vendor/orders/:id/send-delivery-otp
 * @access  Private (Vendor)
 */
VendorOrderrouter.post('/:id/send-delivery-otp', asyncHandler(async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await Order.findById(id);
        if (!order) return next(new ApiError(404, 'Order not found'));

        if (order.status !== 'shipped') {
            return next(
                new ApiError(
                    400,
                    `OTP can only be sent when order is "shipped". Current status: "${order.status}"`
                )
            );
        }

        const result = await sendDeliveryOTP(id);

        return res.status(200).json({
            success: true,
            message: `Delivery OTP sent to customer's email`,
            data: {
                orderNumber: result.orderNumber,
                sentTo:      maskEmail(result.email),
            },
        });
    } catch (err) {
        next(err);
    }
}));

/**
 * @desc    Update order status with transition logic and OTP verification for delivery
 * @route   PATCH /api/v1/vendor/orders/:id/status
 * @access  Private (Vendor)
 */
VendorOrderrouter.patch('/:id/status', requireDeliveryOtp, updateOrderStatus);

export default VendorOrderrouter;