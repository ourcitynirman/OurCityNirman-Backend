import Order from '../../models/Order.model.js';
import Shop from '../../models/shop.model.js';
import Product from '../../models/Product.js';
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

async function findVendorOrder(orderId, productIds) {
    const order = await Order.findOne({
        _id: orderId,
        'items.product': { $in: productIds },
    }).populate('items.product', 'name price images');

    if (!order) throw new ApiError(404, 'Order not found');
    return order;
}

export async function getVendorOrders(req, res, next) {
    try {
        const { page = 1, limit = 10, status } = req.query;

        const pageNum  = Math.max(1, parseInt(page,  10));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

        const { productIds } = await getVendorProductIds(req.user._id);

        if (productIds.length === 0) {
            return res.status(200).json({
                success: true,
                count:   0,
                total:   0,
                page:    pageNum,
                pages:   0,
                data:    { orders: [] },
            });
        }

        const filter = {
            'items.product': { $in: productIds },
            ...(status ? { status } : {}),
        };

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate('items.product', 'name price images')
                .populate('user', 'fullName email phone')
                .select('-statusHistory -__v')
                .lean(),
            Order.countDocuments(filter),
        ]);

        const productIdSet = new Set(productIds.map((id) => id.toString()));
        const filtered = orders.map((order) => ({
            ...order,
            items: order.items.filter((item) =>
                productIdSet.has(
                    item.product?._id?.toString() ?? item.product?.toString()
                )
            ),
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
        const { productIds } = await getVendorProductIds(req.user._id);
        const order = await findVendorOrder(req.params.id, productIds);

        const productIdSet = new Set(productIds.map((id) => id.toString()));
        const vendorItems  = order.items.filter((item) =>
            productIdSet.has(
                item.product?._id?.toString() ?? item.product?.toString()
            )
        );

        return res.status(200).json({
            success: true,
            data: {
                order: {
                    ...order.toObject(),
                    items: vendorItems,
                },
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

        const { productIds } = await getVendorProductIds(req.user._id);
        const order           = await findVendorOrder(req.params.id, productIds);

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