import mongoose from 'mongoose';
import Order, { calcEstimatedDelivery } from '../../models/Order.model.js';
import Cart    from '../../models/cart.model.js';
import Product from '../../models/Product.js';
import Address from '../../models/UserAddress.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError     from '../../utils/ApiError.js';
import { createAndSendInvoice } from '../../services/invoice.service.js';

const DELIVERY_CHARGE     = 50;
const FREE_DELIVERY_ABOVE = 50_000;

const DELIVERY_RATES = {
    standard: 0,
    express: 99,
    same_day: 199
};

function calcDeliveryCharge(subtotal, type = 'standard') {
    if (type === 'standard' || !DELIVERY_RATES[type]) {
       return subtotal >= 50000 ? 0 : 50; 
    }
    return DELIVERY_RATES[type];
}

export const placeOrder = asyncHandler(async (req, res) => {
    const { addressId, paymentMethod = 'cod', notes, deliveryType = 'standard' } = req.body;

    if (!addressId) throw new ApiError(400, 'Delivery address is required');

    const VALID_METHODS = ['cod'];
    if (!VALID_METHODS.includes(paymentMethod)) {
        throw new ApiError(400, `paymentMethod must be one of: ${VALID_METHODS.join(', ')}`);
    }

    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!address) throw new ApiError(404, 'Delivery address not found');

    const cart = await Cart.findOne({ user: req.user._id }).populate({
        path:   'items.product',
        select: 'name price images category brand quantityAvailable isActive vendorId',
    });

    if (!cart || cart.items.length === 0) throw new ApiError(400, 'Your cart is empty');

    const orderItems   = [];
    const stockUpdates = [];
    const categories   = [];

    for (const item of cart.items) {
        const product = item.product;

        if (!product)          throw new ApiError(400, 'One or more products in your cart no longer exist');
        if (!product.isActive) throw new ApiError(400, `Product "${product.name}" is no longer available`);
        if (!product.vendorId) throw new ApiError(400, `Vendor not found for "${product.name}"`);

        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
            throw new ApiError(400, `Invalid quantity for "${product.name}"`);
        }

        if (product.quantityAvailable < item.quantity) {
            throw new ApiError(
                400,
                `Insufficient stock for "${product.name}". Available: ${product.quantityAvailable}`
            );
        }

        orderItems.push({
            product:  product._id,
            vendor:   product.vendorId,
            productSnapshot: {
                name:     product.name,
                image:    product.images?.[0] ?? null,
                category: product.category,
                brand:    product.brand,
            },
            quantity:   item.quantity,
            price:      product.price,
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
    
    // adjust estimated delivery based on deliveryType
    let estimatedDelivery = calcEstimatedDelivery(categories);
    if (deliveryType === 'same_day') {
        estimatedDelivery = new Date(); // today
    } else if (deliveryType === 'express') {
        const d = new Date();
        d.setDate(d.getDate() + 2); // 2 days
        estimatedDelivery = d;
    }

    const deliveryAddress = {
        fullName: address.fullName,
        phone:    address.phone,
        line1:    address.line1,
        line2:    address.line2    ?? null,
        village:  address.village  ?? null,
        landmark: address.landmark ?? null,
        city:     address.city,
        state:    address.state,
        pincode:  address.pincode,
        country:  address.country  ?? 'India',
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
                         user: req.user._id,
                         items: vItems,
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
                             status:    'placed',
                             changedBy: 'user',
                             note:      'Order placed successfully',
                         }],
                     }],
                     { session }
                 );
                 createdOrders.push(newOrder);
             }

            await Promise.all(
                stockUpdates.map(({ id, quantity }) =>
                    Product.findByIdAndUpdate(
                        id,
                        { $inc: { quantityAvailable: -quantity } },
                        { session }
                    )
                )
            );

            await Cart.findOneAndUpdate(
                { user: req.user._id },
                { $set: { items: [], totalPrice: 0, totalItems: 0 } },
                { session }
            );
        });
    } finally {
        session.endSession();
    }

    if (createdOrders.length === 0) throw new ApiError(500, 'Order creation failed. Please try again.');

    // Generate and send invoices for all orders (non-blocking)
    createdOrders.forEach(order => {
        createAndSendInvoice(order, req.user)
            .catch(err => console.error(`Post-placement invoice job failed for ${order.orderNumber}:`, err));
    });

    res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        data: {
            orders: createdOrders,
            orderNumber: createdOrders.map(o => o.orderNumber).join(', '),
            estimatedDelivery,
        },
    });
});

export const getMyOrders = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const orders = await Order.getUserOrders(req.user._id, { page: pageNum, limit: limitNum, status });
    const total  = await Order.countDocuments({
        user: req.user._id,
        ...(status ? { status } : {}),
    });

    res.status(200).json({
        success: true,
        count: orders.length,
        total,
        pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
        data: { orders },
    });
});

export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId)
        .populate('items.product', 'name price images slug')
        .lean({ virtuals: true }); 

    if (!order) throw new ApiError(404, 'Order not found');

    if (req.user.role === 'user') {
        if (order.user.toString() !== req.user._id.toString()) {
            throw new ApiError(403, 'Access denied');
        }
    }

    if (req.user.role === 'vendor') {
        const hasItem = order.items.some(
            (item) => item.vendor.toString() === req.user._id.toString()
        );
        if (!hasItem) throw new ApiError(403, 'Access denied');
    }

    res.status(200).json({ success: true, data: { order } });
});

export const getOrderHistory = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId)
        .select('orderNumber status statusHistory estimatedDelivery deliveredAt user')
        .lean({ virtuals: true });

    if (!order) throw new ApiError(404, 'Order not found');

    if (
        req.user.role === 'user' &&
        order.user.toString() !== req.user._id.toString()
    ) {
        throw new ApiError(403, 'Access denied');
    }

    res.status(200).json({
        success: true,
        data: {
            orderNumber:       order.orderNumber,
            currentStatus:     order.status,
            estimatedDelivery: order.estimatedDelivery,
            deliveredAt:       order.deliveredAt,
            isOverdue:         order.isOverdue,
            overdueByDays:     order.overdueByDays,
            timeline:          order.statusHistory,
        },
    });
});

export const cancelOrder = asyncHandler(async (req, res) => {
    const { reason = '' } = req.body;

    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
    if (!order) throw new ApiError(404, 'Order not found');

    if (!order.isCancellable) {
        throw new ApiError(
            400,
            `Order cannot be cancelled. Current status is "${order.status}". Delivered or already completed orders cannot be cancelled.`
        );
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const cancelled = await order.cancel(reason, 'user', session);

            if (!cancelled) throw new ApiError(400, 'Unable to cancel this order');

            await Promise.all(
                order.items.map((item) =>
                    Product.findByIdAndUpdate(
                        item.product,
                        { $inc: { quantityAvailable: item.quantity } },
                        { session }
                    )
                )
            );
        });
    } finally {
        session.endSession();
    }

    res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: { order },
    });
});


export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status, note } = req.body;

    if (!status) throw new ApiError(400, 'Status is required');

    if (status === 'cancelled') {
        throw new ApiError(403, 'Vendors are not permitted to cancel orders. Only users or admins possess cancellation rights.');
    }

    const VENDOR_ALLOWED = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
    if (!VENDOR_ALLOWED.includes(status)) {
        throw new ApiError(
            400,
            `Vendors can only set the following statuses: ${VENDOR_ALLOWED.join(', ')}`
        );
    }

    const order = await Order.findOne({
        _id:            req.params.orderId,
        'items.vendor': req.user._id,
    });

    if (!order) throw new ApiError(404, 'Order not found or access denied');

    try {
        await order.updateStatus(status, note || null, 'vendor');
    } catch (err) {
        throw new ApiError(400, err.message);
    }

    order.items.forEach((item) => {
        if (item.vendor.toString() === req.user._id.toString()) {
            item.itemStatus = status;
        }
    });

    await order.save();

    res.status(200).json({
        success: true,
        message: `Order status updated to "${status}"`,
        data: { order },
    });
});

export const getVendorOrders = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const matchStage = { 'items.vendor': new mongoose.Types.ObjectId(req.user._id) };
    if (status) matchStage.status = status;

    const pipeline = [
        { $match: matchStage },
        {
            $addFields: {
                items: {
                    $filter: {
                        input: '$$ROOT.items',
                        as:    'item',
                        cond:  { $eq: ['$$item.vendor', new mongoose.Types.ObjectId(req.user._id)] },
                    },
                },
            },
        },
        {
            $addFields: {
                isOverdue: {
                    $and: [
                        { $ne: ['$estimatedDelivery', null] },
                        { $not: [{ $in: ['$status', ['delivered', 'cancelled', 'refunded']] }] },
                        { $lt: ['$estimatedDelivery', new Date()] },
                    ],
                },
                overdueByDays: {
                    $cond: {
                        if: {
                            $and: [
                                { $ne: ['$estimatedDelivery', null] },
                                { $not: [{ $in: ['$status', ['delivered', 'cancelled', 'refunded']] }] },
                                { $lt: ['$estimatedDelivery', new Date()] },
                            ],
                        },
                        then: {
                            $ceil: {
                                $divide: [
                                    { $subtract: [new Date(), '$estimatedDelivery'] },
                                    1000 * 60 * 60 * 24,
                                ],
                            },
                        },
                        else: 0,
                    },
                },
            },
        },
        { $sort: { isOverdue: -1, createdAt: -1 } },
        {
            $facet: {
                data:  [{ $skip: skip }, { $limit: limitNum }],
                total: [{ $count: 'count' }],
            },
        },
    ];

    const result = await Order.aggregate(pipeline);
    const orders = result[0]?.data            || [];
    const total  = result[0]?.total?.[0]?.count || 0;

    res.status(200).json({
        success: true,
        count: orders.length,
        total,
        pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
        data: { orders },
    });
});

export const updateItemTracking = asyncHandler(async (req, res) => {
    const { orderId, itemId } = req.params;
    const { trackingNumber, shippingCarrier, itemStatus } = req.body;

    const VALID_ITEM_STATUSES = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

    if (itemStatus && !VALID_ITEM_STATUSES.includes(itemStatus)) {
        throw new ApiError(400, `itemStatus must be one of: ${VALID_ITEM_STATUSES.join(', ')}`);
    }

    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const item = order.items.id(itemId);
    if (!item) throw new ApiError(404, 'Order item not found');

    if (item.vendor.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You can only update your own items');
    }

    if (trackingNumber)  item.trackingNumber  = trackingNumber;
    if (shippingCarrier) item.shippingCarrier  = shippingCarrier;
    if (itemStatus)      item.itemStatus       = itemStatus;

    const allShipped = order.items.every(
        (i) => ['shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(i.itemStatus)
    );
    if (allShipped && order.status === 'processing') {
        order.status = 'shipped';
        order.statusHistory.push({ status: 'shipped', changedBy: 'vendor', note: 'All items shipped' });
    }

    await order.save();

    res.status(200).json({ success: true, message: 'Tracking updated', data: { order } });
});

export const adminGetAllOrders = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, search, overdueOnly } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (search) filter.orderNumber = { $regex: search, $options: 'i' };

    if (overdueOnly === 'true') {
        filter.estimatedDelivery = { $lt: new Date() };
        filter.status = { $nin: ['delivered', 'cancelled', 'refunded'] };
    }

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean({ virtuals: true }),
        Order.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        count: orders.length,
        total,
        pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
        data: { orders },
    });
});

export const adminCancelOrder = asyncHandler(async (req, res) => {
    const { reason } = req.body;

    if (!reason) throw new ApiError(400, 'Cancellation reason is required');

    const order = await Order.findById(req.params.orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    if (['cancelled', 'refunded'].includes(order.status)) {
        throw new ApiError(400, `Order already "${order.status}"`);
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            order.status       = 'cancelled';
            order.cancelReason = reason;
            order.cancelledBy  = 'admin';
            order.cancelledAt  = new Date();
            order.adminNotes   = `Admin override by ${req.user._id}: ${reason}`;

            order.statusHistory.push({
                status:    'cancelled',
                changedBy: 'admin',
                note:      reason,
            });

            await order.save({ session });

            await Promise.all(
                order.items.map((item) =>
                    Product.findByIdAndUpdate(
                        item.product,
                        { $inc: { quantityAvailable: item.quantity } },
                        { session }
                    )
                )
            );
        });
    } finally {
        session.endSession();
    }

    res.status(200).json({
        success: true,
        message: 'Order cancelled by admin',
        data: { order },
    });
});

export const adminUpdateOrderStatus = asyncHandler(async (req, res) => {
    const { status, note } = req.body;

    if (!status) throw new ApiError(400, 'Status is required');

    const order = await Order.findById(req.params.orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    try {
        await order.updateStatus(status, note || null, 'admin');
    } catch (err) {
        throw new ApiError(400, err.message);
    }

    res.status(200).json({
        success: true,
        message: `Order status updated to "${status}"`,
        data: { order },
    });
});