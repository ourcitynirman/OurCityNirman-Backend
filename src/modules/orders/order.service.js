import mongoose from 'mongoose';
import Order, { calcEstimatedDelivery } from './order.model.js';
import OrderItem from './order-item.model.js';
import Cart from '../cart/cart.model.js';
import Product from '../products/product.model.js';
import Address from '../address/address.model.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import InvoiceService from '../invoice/invoice.service.js';
import { ROLES } from '../../shared/constants/roles.js';
import { sendDeliveryOTP, verifyDeliveryOTP } from '../../shared/services/delivery-otp.service.js';

const DELIVERY_RATES = {
    standard: 0,
    express: 0,
    same_day: 0,
    pay_later: 0
};

function calcDeliveryCharge(subtotal, type = 'pay_later') {
    return 0;
}

class OrderService {
    static async placeOrder(orderData, user) {
        const { addressId, paymentMethod, notes, deliveryType } = orderData;

        if (paymentMethod === 'cod') {
            throw new ApiError(403, 'Cash on Delivery (COD) is temporarily disabled. Please use Online Payment via Razorpay.');
        }

        const address = await Address.findOne({ _id: addressId, user: user._id });
        if (!address) throw new ApiError(404, 'Delivery address not found');

        const cart = await Cart.findOne({ user: user._id }).populate({
            path: 'items.product',
            select: 'name price images category brand quantityAvailable isActive vendorId',
            populate: [
                { path: 'brand', select: 'name' },
                { path: 'category', select: 'name' }
            ]
        });

        if (!cart || cart.items.length === 0) throw new ApiError(400, 'Your cart is empty');

        const orderItems = [];
        const stockUpdates = [];
        const categories = [];

        for (const item of cart.items) {
            const product = item.product;

            if (!product) throw new ApiError(400, 'One or more products in your cart no longer exist');
            if (!product.isActive) throw new ApiError(400, `Product "${product.name}" is no longer available`);
            if (!product.vendorId) throw new ApiError(400, `Vendor not found for "${product.name}"`);

            if (product.vendorId.toString() === user._id.toString()) {
                throw new ApiError(400, `You cannot purchase your own product: "${product.name}"`);
            }

            if (product.quantityAvailable < item.quantity) {
                throw new ApiError(400, `Insufficient stock for "${product.name}". Available: ${product.quantityAvailable}`);
            }

            orderItems.push({
                product: product._id,
                vendor: product.vendorId,
                productSnapshot: {
                    name: product.name,
                    image: product.images?.[0]?.url || product.images?.[0] || null,
                    category: product.category?.name || product.category || null,
                    brand: product.brand?.name || product.brand || null,
                },
                quantity: item.quantity,
                price: product.price,
                totalPrice: product.price * item.quantity,
                itemStatus: 'pending',
            });

            stockUpdates.push({ id: product._id, quantity: item.quantity });
            if (product.category) categories.push(product.category);
        }

        const itemsByVendor = {};
        for (const item of orderItems) {
            const vId = item.vendor.toString();
            if (!itemsByVendor[vId]) itemsByVendor[vId] = [];
            itemsByVendor[vId].push(item);
        }

        const totalSubtotal = orderItems.reduce((sum, i) => sum + i.totalPrice, 0);
        const totalDeliveryCharge = calcDeliveryCharge(totalSubtotal, deliveryType);

        let estimatedDelivery = calcEstimatedDelivery(categories);
        if (deliveryType === 'same_day') {
            estimatedDelivery = new Date();
        } else if (deliveryType === 'express') {
            const d = new Date();
            d.setDate(d.getDate() + 2);
            estimatedDelivery = d;
        }

        const deliveryAddress = {
            fullName: address.fullName,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2 ?? null,
            village: address.village ?? null,
            landmark: address.landmark ?? null,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            country: address.country ?? 'India',
        };

        const session = await mongoose.startSession();
        const createdOrders = [];

        try {
            await session.withTransaction(async () => {
                const vendorIds = Object.keys(itemsByVendor);
                let allocatedDeliveryCharge = 0;

                for (let i = 0; i < vendorIds.length; i++) {
                    const vId = vendorIds[i];
                    const vItems = itemsByVendor[vId];
                    const vSubtotal = vItems.reduce((sum, item) => sum + item.totalPrice, 0);

                    let vDeliveryCharge = 0;
                    if (i === vendorIds.length - 1) {
                        vDeliveryCharge = Math.max(0, totalDeliveryCharge - allocatedDeliveryCharge);
                    } else {
                        vDeliveryCharge = Math.round((vSubtotal / totalSubtotal) * totalDeliveryCharge * 100) / 100;
                        allocatedDeliveryCharge += vDeliveryCharge;
                    }

                    const vTotalAmount = Math.round((vSubtotal + vDeliveryCharge) * 100) / 100;

                    const [newOrder] = await Order.create(
                        [{
                            user: user._id,
                            deliveryAddress,
                            subtotal: vSubtotal,
                            deliveryType,
                            deliveryCharge: vDeliveryCharge,
                            totalAmount: vTotalAmount,
                            paymentMethod,
                            paymentStatus: 'pending',
                            estimatedDelivery,
                            notes: notes ?? null,
                            statusHistory: [{
                                status: 'placed',
                                changedBy: 'user',
                                note: 'Order placed successfully',
                            }],
                        }],
                        { session }
                    );

                    await OrderItem.insertMany(
                        vItems.map(item => ({
                            order_id: newOrder._id,
                            user_id: user._id,
                            product: item.product,
                            vendor: item.vendor,
                            productSnapshot: item.productSnapshot,
                            quantity: item.quantity,
                            price: item.price,
                            totalPrice: item.totalPrice,
                            itemStatus: 'pending'
                        })),
                        { session }
                    );

                    createdOrders.push(newOrder);
                }
            });
        } finally {
            session.endSession();
        }

        if (createdOrders.length === 0) throw new ApiError(500, 'Order creation failed');

        return {
            orders: createdOrders,
            estimatedDelivery,
        };
    }

    static async getMyOrders(userId, query) {
        const { page = 1, limit = 10, status } = query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

        const orders = await Order.getUserOrders(userId, { page: pageNum, limit: limitNum, status });
        const total = await Order.countDocuments({
            user: userId,
            ...(status ? { status } : {}),
        });

        const populatedOrders = await Promise.all(orders.map(async (order) => {
            const items = await OrderItem.find({ order_id: order._id }).lean();
            return { ...order, items };
        }));

        return {
            orders: populatedOrders,
            total,
            pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
        };
    }

    static async getOrderById(orderId, user) {
        const order = await Order.findById(orderId).lean({ virtuals: true });
        if (!order) throw new ApiError(404, 'Order not found');

        const items = await OrderItem.getByOrder(order._id);
        order.items = items;

        const isOwner = order.user?.toString() === user._id?.toString();
        const isAdmin = user.role === ROLES.ADMIN;
        const isSeller = user.role === ROLES.VENDOR && items.some(
            (item) => item.vendor?.toString() === user._id?.toString()
        );

        if (isOwner || isAdmin || isSeller) {
            return order;
        }

        throw new ApiError(403, 'Access denied');
    }

    static async getOrderHistory(orderId, user) {
        const order = await Order.findById(orderId)
            .select('orderNumber status statusHistory estimatedDelivery deliveredAt user')
            .lean({ virtuals: true });

        if (!order) throw new ApiError(404, 'Order not found');

        if (user.role === ROLES.USER && order.user.toString() !== user._id.toString()) {
            throw new ApiError(403, 'Access denied');
        }

        return {
            orderNumber: order.orderNumber,
            currentStatus: order.status,
            estimatedDelivery: order.estimatedDelivery,
            deliveredAt: order.deliveredAt,
            isOverdue: order.isOverdue,
            overdueByDays: order.overdueByDays,
            timeline: order.statusHistory,
        };
    }

    static async cancelOrder(orderId, reason, user) {
        const order = await Order.findOne({ _id: orderId, user: user._id });
        if (!order) throw new ApiError(404, 'Order not found');

        if (!order.isCancellable) {
            throw new ApiError(400, `Order cannot be cancelled. Current status is "${order.status}"`);
        }

        await order.cancel(reason, 'user');
        const items = await OrderItem.find({ order_id: order._id });

        await Promise.all(
            items.map((item) =>
                Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { quantityAvailable: item.quantity } }
                )
            )
        );

        await OrderItem.updateMany(
            { order_id: order._id },
            { $set: { itemStatus: 'cancelled', cancelReason: reason, cancelledAt: new Date() } }
        );

        return order;
    }

    static async updateOrderStatus(orderId, status, note, user) {
        if (status === 'delivered') {
            throw new ApiError(400, 'Directly marking order as "delivered" is not allowed. Please use OTP verification.');
        }

        const order = await Order.findById(orderId);
        if (!order) throw new ApiError(404, 'Order not found');

        const vendorItems = await OrderItem.find({ order_id: order._id, vendor: user._id });
        if (vendorItems.length === 0) throw new ApiError(403, 'Access denied. You have no items in this order.');

        try {
            await order.updateStatus(status, note || null, 'vendor');
        } catch (err) {
            throw new ApiError(400, err.message);
        }

        if (status === 'out_for_delivery') {
            sendDeliveryOTP(order._id).catch(err => console.error(`[OTP] Send failed:`, err.message));
        }

        await OrderItem.updateMany(
            { order_id: order._id, vendor: user._id },
            { $set: { itemStatus: status } }
        );

        return order;
    }

    static async verifyDeliveryOrder(orderId, otp, user) {
        const order = await Order.findById(orderId);
        if (!order) throw new ApiError(404, 'Order not found');

        if (order.status !== 'out_for_delivery') {
            throw new ApiError(400, `OTP verification is only allowed for orders with status "out_for_delivery".`);
        }

        if (user.role === ROLES.VENDOR) {
            const hasItem = await OrderItem.exists({ order_id: order._id, vendor: user._id });
            if (!hasItem) throw new ApiError(403, 'Access denied');
        }

        await verifyDeliveryOTP(orderId, otp);

        const updateFilter = { order_id: order._id };
        if (user.role === ROLES.VENDOR) updateFilter.vendor = user._id;
        
        await OrderItem.updateMany(updateFilter, { $set: { itemStatus: 'delivered' } });

        const allItems = await OrderItem.find({ order_id: order._id });
        const isFullyDelivered = allItems.every(item => item.itemStatus === 'delivered' || item.itemStatus === 'cancelled');

        if (isFullyDelivered) {
            await order.updateStatus(
                'delivered', 
                'All items delivered. Order completed via OTP verification.', 
                user.role === ROLES.ADMIN ? 'admin' : 'vendor'
            );
        } else {
            order.statusHistory.push({
                status: order.status,
                changedBy: user.role === ROLES.ADMIN ? 'admin' : 'vendor',
                note: `Items for ${user.role === ROLES.VENDOR ? 'vendor ' + user.fullName : 'admin'} delivered via OTP.`
            });
            await order.save();
        }

        return { order, isFullyDelivered };
    }

    static async resendDeliveryOTP(orderId, user) {
        const order = await Order.findById(orderId);
        if (!order) throw new ApiError(404, 'Order not found');

        if (order.status !== 'out_for_delivery') {
            throw new ApiError(400, 'OTP resend is only allowed for orders with status "out_for_delivery".');
        }

        if (user.role === ROLES.VENDOR) {
            const hasItem = await OrderItem.exists({ order_id: order._id, vendor: user._id });
            if (!hasItem) throw new ApiError(403, 'Access denied');
        }

        await sendDeliveryOTP(order._id);
        return { order };
    }

    static async getVendorOrders(query, user) {
        const { page = 1, limit = 10, status } = query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const matchStage = { vendor: new mongoose.Types.ObjectId(user._id) };
        if (status) matchStage.itemStatus = status;

        const pipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: '$order_id',
                    vendorItems: { $push: '$$ROOT' },
                    vendorSubtotal: { $sum: '$totalPrice' }
                }
            },
            { $lookup: { from: 'orders', localField: '_id', foreignField: '_id', as: 'order' } },
            { $unwind: '$order' },
            {
                $project: {
                    _id: '$_id',
                    orderNumber: '$order.orderNumber',
                    status: '$order.status',
                    createdAt: '$order.createdAt',
                    estimatedDelivery: '$order.estimatedDelivery',
                    deliveryType: '$order.deliveryType',
                    paymentMethod: '$order.paymentMethod',
                    paymentStatus: '$order.paymentStatus',
                    deliveryAddress: '$order.deliveryAddress',
                    subtotal: '$vendorSubtotal',
                    totalAmount: '$order.totalAmount',
                    items: '$vendorItems',
                    isOverdue: {
                        $and: [
                            { $ne: ['$order.estimatedDelivery', null] },
                            { $not: [{ $in: ['$order.status', ['delivered', 'cancelled', 'refunded']] }] },
                            { $lt: ['$order.estimatedDelivery', new Date()] },
                        ],
                    },
                    overdueByDays: {
                        $cond: {
                            if: {
                                $and: [
                                    { $ne: ['$order.estimatedDelivery', null] },
                                    { $not: [{ $in: ['$order.status', ['delivered', 'cancelled', 'refunded']] }] },
                                    { $lt: ['$order.estimatedDelivery', new Date()] },
                                ],
                            },
                            then: { $ceil: { $divide: [{ $subtract: [new Date(), '$order.estimatedDelivery'] }, 1000 * 60 * 60 * 24] } },
                            else: 0,
                        },
                    },
                }
            },
            { $sort: { isOverdue: -1, createdAt: -1 } },
            {
                $facet: {
                    data: [{ $skip: skip }, { $limit: limitNum }],
                    total: [{ $count: 'count' }]
                }
            }
        ];

        const result = await OrderItem.aggregate(pipeline);
        const total = result[0]?.total?.[0]?.count || 0;
        return {
            orders: result[0]?.data || [],
            total,
            pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
        };
    }

    static async updateItemTracking(orderId, itemId, trackingData, user) {
        const { trackingNumber, shippingCarrier, itemStatus } = trackingData;
        const item = await OrderItem.findById(itemId);
        if (!item || item.order_id.toString() !== orderId) throw new ApiError(404, 'Order item not found');

        if (item.vendor.toString() !== user._id.toString()) throw new ApiError(403, 'Unauthorized');

        if (trackingNumber) item.trackingNumber = trackingNumber;
        if (shippingCarrier) item.shippingCarrier = shippingCarrier;
        if (itemStatus) item.itemStatus = itemStatus;
        await item.save();

        const order = await Order.findById(orderId);
        const allItems = await OrderItem.find({ order_id: orderId });

        const allShipped = allItems.every(i => ['shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(i.itemStatus));
        if (allShipped && order.status === 'processing') {
            order.status = 'shipped';
            order.statusHistory.push({ status: 'shipped', changedBy: 'vendor', note: 'All items shipped' });
            await order.save();
        }

        return item;
    }

    static async adminGetAllOrders(query) {
        const { page = 1, limit = 20, status, search, overdueOnly } = query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const filter = {};
        if (status) filter.status = status;
        if (search) filter.orderNumber = { $regex: search, $options: 'i' };

        if (overdueOnly === 'true') {
            filter.estimatedDelivery = { $lt: new Date() };
            filter.status = { $nin: ['delivered', 'cancelled', 'refunded'] };
        }

        const [orders, total] = await Promise.all([
            Order.find(filter).populate('user', 'name email phone').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean({ virtuals: true }),
            Order.countDocuments(filter),
        ]);

        const populatedOrders = await Promise.all(orders.map(async (order) => {
            const items = await OrderItem.find({ order_id: order._id }).lean();
            return { ...order, items };
        }));

        return {
            orders: populatedOrders,
            total,
            pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
        };
    }

    static async adminCancelOrder(orderId, reason, user) {
        const order = await Order.findById(orderId);
        if (!order) throw new ApiError(404, 'Order not found');

        if (['cancelled', 'refunded'].includes(order.status)) {
            throw new ApiError(400, `Order already "${order.status}"`);
        }

        order.status = 'cancelled';
        order.cancelReason = reason;
        order.cancelledBy = 'admin';
        order.cancelledAt = new Date();
        order.adminNotes = `Admin override by ${user._id}: ${reason}`;

        order.statusHistory.push({ status: 'cancelled', changedBy: 'admin', note: reason });
        await order.save();

        const items = await OrderItem.find({ order_id: order._id });
        await Promise.all(items.map((item) => Product.findByIdAndUpdate(item.product, { $inc: { quantityAvailable: item.quantity } })));
        await OrderItem.updateMany({ order_id: order._id }, { $set: { itemStatus: 'cancelled', cancelReason: reason, cancelledAt: new Date() } });

        return order;
    }

    static async adminUpdateOrderStatus(orderId, status, note) {
        const order = await Order.findById(orderId);
        if (!order) throw new ApiError(404, 'Order not found');

        try {
            await order.updateStatus(status, note || null, 'admin');
        } catch (err) {
            throw new ApiError(400, err.message);
        }

        return order;
    }
}

export default OrderService;
