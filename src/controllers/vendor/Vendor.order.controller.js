import Order from '../../models/Order.model.js';
import OrderItem from '../../models/OrderItem.model.js';
import Shop from '../../models/shop.model.js';
import Product from '../../models/Product.model.js';
import ApiError from '../../utils/ApiError.js';

const STATUS_TRANSITIONS = {
    placed:     'confirmed',
    confirmed:  'processing',
    processing: 'shipped',
    shipped:    'delivered',
};

const VENDOR_ALLOWED_STATUSES = Object.values(STATUS_TRANSITIONS);


async function getVendorProductIds(vendorId) {
    const shop = await Shop.findOne({ vendor: vendorId, isActive: true });
    if (!shop) throw new ApiError(403, 'You do not have an active shop');

    const products = await Product.find({ vendorId: vendorId, isActive: true }, '_id');
    return {
        shopId:     shop._id,
        productIds: products.map((p) => p._id),
    };
}

async function findVendorOrder(orderId, vendorId) {
    const order = await Order.findById(orderId).lean();
    if (!order) throw new ApiError(404, 'Order not found');

    const items = await OrderItem.find({ order_id: orderId, vendor: vendorId })
        .populate('product', 'name price images');
    
    order.items = items;
    return order;
}

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
            count:   filtered.length,
            total,
            page:    pageNum,
            pages:   Math.ceil(total / limitNum),
            data:    { orders: filtered },
        });
    } catch (err) {
        next(err);
    }
}


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

        if (!VENDOR_ALLOWED_STATUSES.includes(status)) {
            return next(
                new ApiError(
                    400,
                    `Invalid status. Vendor can set: ${VENDOR_ALLOWED_STATUSES.join(', ')}`
                )
            );
        }

        if (status === 'delivered' && !req.otpVerified) {
            return next(new ApiError(403, 'OTP verification required to mark order as delivered'));
        }

        const order = await findVendorOrder(req.params.id, req.user._id);

        if (order.status === 'cancelled') {
            return next(new ApiError(400, 'Cannot update status of a cancelled order'));
        }

        const expectedNext = STATUS_TRANSITIONS[order.status];
        if (!expectedNext) {
            return next(
                new ApiError(400, `Order is already at final status: "${order.status}"`)
            );
        }

        if (status !== expectedNext) {
            return next(
                new ApiError(
                    400,
                    `Invalid transition. Order is "${order.status}", next allowed status is "${expectedNext}"`
                )
            );
        }

        order.updateStatus(status, note || null, 'vendor');

        if (status === 'delivered') {
            order.deliveredAt   = new Date();
            order.paymentStatus = order.paymentMethod === 'cod' ? 'paid' : order.paymentStatus;
        }

        await order.save();

        return res.status(200).json({
            success: true,
            message: `Order status updated to "${status}"`,
            data:    { order },
        });
    } catch (err) {
        next(err);
    }
}