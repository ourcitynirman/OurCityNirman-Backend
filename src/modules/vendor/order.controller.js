import Order from '../orders/order.model.js';
import OrderItem from '../orders/order-item.model.js';
import Shop from '../shop/shop.model.js';
import Product from '../products/product.model.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { sendDeliveryOTP } from '../../shared/services/delivery-otp.service.js';
import { maskEmail } from '../../shared/utils/validation.utils.js';



async function findVendorOrder(orderId, vendorId) {
    const order = await Order.findById(orderId).lean();
    if (!order) throw new ApiError(404, 'Order not found');

    const items = await OrderItem.find({ order_id: orderId, vendor: vendorId })
        .populate('product', 'name price images');
    
    order.items = items;
    return order;
}

/**
 * @desc    Get all orders containing products from the current vendor
 * @route   GET /api/v1/vendor/orders/
 * @access  Private (Vendor)
 */
export async function getVendorOrders(req, res, next) {
    try {
        const { page = 1, limit = 10, status } = req.query;

        const pageNum  = Math.max(1, parseInt(page,  10));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

        const filter = {
            vendor: req.user._id,
            ...(status ? { itemStatus: status } : {}),
        };

        const [items, total] = await Promise.all([
            OrderItem.find(filter)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate('order_id', 'orderNumber totalAmount paymentStatus createdAt estimatedDelivery')
                .populate('product', 'name price images')
                .lean(),
            OrderItem.countDocuments(filter),
        ]);

        const enriched = items.map((item) => ({
            ...item.order_id,
            _id: item.order_id._id,
            items: [item],
        }));

        return res.status(200).json({
            success: true,
            count:   enriched.length,
            total,
            page:    pageNum,
            pages:   Math.ceil(total / limitNum),
            data:    { orders: enriched },
        });
    } catch (err) {
        next(err);
    }
}


/**
 * @desc    Get full details of a specific order for the vendor
 * @route   GET /api/v1/vendor/orders/:id
 * @access  Private (Vendor)
 */
export async function getVendorOrder(req, res, next) {
    try {
        const order = await findVendorOrder(req.params.id, req.user._id);

        return res.status(200).json({
            success: true,
            data: {
                order
            },
        });
    } catch (err) {
        next(err);
    }
}



export async function updateOrderStatus(req, res, next) {
    try {
        const { status, note = '' } = req.body;

        if (!status) {
            return next(new ApiError(400, 'Status is required'));
        }

        const VENDOR_ALLOWED = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
        if (!VENDOR_ALLOWED.includes(status)) {
            return next(
                new ApiError(
                    400,
                    `Invalid status. Vendor can set: ${VENDOR_ALLOWED.join(', ')}`
                )
            );
        }

        if (status === 'delivered' && !req.otpVerified) {
            return next(new ApiError(403, 'OTP verification required to mark order as delivered'));
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return next(new ApiError(404, 'Order not found'));
        }

        const vendorItems = await OrderItem.find({ order_id: order._id, vendor: req.user._id });
        if (vendorItems.length === 0) {
            return next(new ApiError(403, 'Access denied. You have no items in this order.'));
        }

        if (order.status === 'cancelled') {
            return next(new ApiError(400, 'Cannot update status of a cancelled order'));
        }

        try {
            await order.updateStatus(status, note || null, 'vendor');
        } catch (err) {
            return next(new ApiError(400, err.message));
        }

        // --- OTP TRIGGER ---
        if (status === 'out_for_delivery') {
            try {
                await sendDeliveryOTP(order._id);
            } catch (otpErr) {
                console.error(`[OTP] Auto-send failed for ${order.orderNumber}:`, otpErr.message);
            }
        }

        if (status === 'delivered') {
            order.deliveredAt = new Date();
            if (order.paymentMethod === 'cod') {
                order.paymentStatus = 'paid';
            }
            await order.save();
        }

        // Sync individual items
        await OrderItem.updateMany(
            { order_id: order._id, vendor: req.user._id },
            { $set: { itemStatus: status } }
        );

        return res.status(200).json({
            success: true,
            message: `Order status updated to "${status}"${status === 'out_for_delivery' ? ' and Delivery OTP sent to customer.' : ''}`,
            data:    { order },
        });
    } catch (err) {
        next(err);
    }
}