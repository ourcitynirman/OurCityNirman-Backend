import { Router } from 'express';
import {
    getVendorOrders,
    getVendorOrder,
    updateOrderStatus,
} from '../../controllers/vendor/Vendor.order.controller.js';
import {
    authenticate,
    authorize,
    requireVerification,
} from '../../middlewares/auth.middleware.js';
import {
    sendDeliveryOTP,
    verifyDeliveryOTP,
} from '../../services/Delivery.otp.service.js';
import Order from '../../models/Order.model.js';
import ApiError from '../../utils/ApiError.js';

const VendorOrderrouter = Router();


VendorOrderrouter.use(authenticate);
VendorOrderrouter.use(authorize('vendor'));
VendorOrderrouter.use(requireVerification);




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



VendorOrderrouter.get('/', getVendorOrders);

VendorOrderrouter.get('/:id', getVendorOrder);


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

// status placed confirmed processing shipped (OTP)→delivered
VendorOrderrouter.patch('/:id/status', requireDeliveryOtp, updateOrderStatus);

export default VendorOrderrouter;