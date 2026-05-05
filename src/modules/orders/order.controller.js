import mongoose from 'mongoose';
import Order, { calcEstimatedDelivery } from './order.model.js';
import OrderItem from './order-item.model.js';
import Cart from '../cart/cart.model.js';
import Product from '../products/product.model.js';
import Address from '../address/address.model.js';
import { asyncHandler } from '../../shared/utils/api.utils.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { createAndSendInvoice } from '../invoice/invoice.service.js';
import { ROLES } from '../../shared/constants/roles.js';
import { sendDeliveryOTP, verifyDeliveryOTP } from '../../shared/services/delivery-otp.service.js';

const DELIVERY_CHARGE = 50;
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

/**
 * @desc    Place a new order from cart
 * @route   POST /api/v1/orders/
 * @access  Private
 */
export const placeOrder = asyncHandler(async (req, res) => {
    // Defaulting to 'online' as COD is temporarily disabled for production readiness
    const { addressId, paymentMethod = 'online', notes, deliveryType = 'standard' } = req.body;

    if (!addressId) throw new ApiError(400, 'Delivery address is required');

    // Currently only 'online' is active. 'cod' is kept in VALID_METHODS but restricted via a check.
    const VALID_METHODS = ['online', 'cod']; 
    if (!VALID_METHODS.includes(paymentMethod)) {
        throw new ApiError(400, `paymentMethod must be one of: ${VALID_METHODS.join(', ')}`);
    }

    if (paymentMethod === 'cod') {
        throw new ApiError(403, 'Cash on Delivery (COD) is temporarily disabled. Please use Online Payment via Razorpay.');
    }

    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!address) throw new ApiError(404, 'Delivery address not found');

    const cart = await Cart.findOne({ user: req.user._id }).populate({
        path: 'items.product',
        select: 'name price images category brand quantityAvailable isActive vendorId',
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

        if (product.vendorId.toString() === req.user._id.toString()) {
            throw new ApiError(400, `You cannot purchase your own product: "${product.name}"`);
        }

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
            product: product._id,
            vendor: product.vendorId,
            productSnapshot: {
                name: product.name,
                image: product.images?.[0] ?? null,
                category: product.category,
                brand: product.brand,
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
                        user: req.user._id,
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

                // Create OrderItem records
                await OrderItem.insertMany(
                    vItems.map(item => ({
                        order_id: newOrder._id,
                        user_id: req.user._id,
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

            if (paymentMethod === 'cod') {
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
            }
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

/**
 * @desc    Get currently logged-in user's orders
 * @route   GET /api/v1/orders/
 * @access  Private
 */
export const getMyOrders = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const orders = await Order.getUserOrders(req.user._id, { page: pageNum, limit: limitNum, status });
    const total = await Order.countDocuments({
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

/**
 * @desc    Get full details of a specific order
 * @route   GET /api/v1/orders/:orderId
 * @access  Private
 */
export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId)
        .lean({ virtuals: true });

    if (!order) throw new ApiError(404, 'Order not found');

    const items = await OrderItem.getByOrder(order._id);
    order.items = items;

    const isOwner = order.user?.toString() === req.user._id?.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;
    const isSeller = req.user.role === ROLES.VENDOR && items.some(
        (item) => item.vendor?.toString() === req.user._id?.toString()
    );

    if (isOwner || isAdmin || isSeller) {
        return res.status(200).json({ success: true, data: { order } });
    }

    throw new ApiError(403, 'Access denied');
});

/**
 * @desc    Get tracking timeline and history for an order
 * @route   GET /api/v1/orders/:orderId/history
 * @access  Private
 */
export const getOrderHistory = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId)
        .select('orderNumber status statusHistory estimatedDelivery deliveredAt user')
        .lean({ virtuals: true });

    if (!order) throw new ApiError(404, 'Order not found');

    if (
        req.user.role === ROLES.USER &&
        order.user.toString() !== req.user._id.toString()
    ) {
        throw new ApiError(403, 'Access denied');
    }

    res.status(200).json({
        success: true,
        data: {
            orderNumber: order.orderNumber,
            currentStatus: order.status,
            estimatedDelivery: order.estimatedDelivery,
            deliveredAt: order.deliveredAt,
            isOverdue: order.isOverdue,
            overdueByDays: order.overdueByDays,
            timeline: order.statusHistory,
        },
    });
});

/**
 * @desc    Cancel an order (User initiated)
 * @route   PATCH /api/v1/orders/:orderId/cancel
 * @access  Private
 */
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

            const items = await OrderItem.find({ order_id: order._id }).session(session);

            await Promise.all(
                items.map((item) =>
                    Product.findByIdAndUpdate(
                        item.product,
                        { $inc: { quantityAvailable: item.quantity } },
                        { session }
                    )
                )
            );

            // Cancel all items as well
            await OrderItem.updateMany(
                { order_id: order._id },
                { $set: { itemStatus: 'cancelled', cancelReason: reason, cancelledAt: new Date() } },
                { session }
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


/**
 * @desc    Update status of an order (Vendor limited access)
 * @route   PATCH /api/v1/orders/:orderId/status
 * @access  Private (Vendor)
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status, note } = req.body;

    if (!status) throw new ApiError(400, 'Status is required');

    if (status === 'delivered') {
        throw new ApiError(400, 'Directly marking order as "delivered" is not allowed. Please use the OTP verification endpoint for secure delivery confirmation.');
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    // Check if vendor has items in this order
    const vendorItems = await OrderItem.find({
        order_id: order._id,
        vendor: req.user._id
    });

    if (vendorItems.length === 0) throw new ApiError(403, 'Access denied. You have no items in this order.');

    try {
        await order.updateStatus(status, note || null, 'vendor');
    } catch (err) {
        throw new ApiError(400, err.message);
    }

    // --- OTP TRIGGER ---
    if (status === 'out_for_delivery') {
        try {
            await sendDeliveryOTP(order._id);
        } catch (otpErr) {
            console.error(`[OTP] Auto-send failed for ${order.orderNumber}:`, otpErr.message);
            // Non-blocking for the status update
        }
    }

    // Update individual items belonging to this vendor
    await OrderItem.updateMany(
        { order_id: order._id, vendor: req.user._id },
        { $set: { itemStatus: status } }
    );

    res.status(200).json({
        success: true,
        message: `Order status updated to "${status}"${status === 'out_for_delivery' ? ' and Delivery OTP sent to customer.' : ''}`,
        data: { order },
    });
});

/**
 * @desc    Verify delivery OTP and mark order as delivered
 * @route   POST /api/v1/orders/:orderId/verify-delivery-otp
 * @access  Private (Vendor/Admin)
 */
export const verifyDeliveryOrder = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const { orderId } = req.params;

    if (!otp) throw new ApiError(400, 'OTP is required');

    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    if (order.status !== 'out_for_delivery') {
        throw new ApiError(400, `OTP verification is only allowed for orders with status "out_for_delivery". Current: "${order.status}"`);
    }

    // Auth check: Vendor must have items in this order or be Admin
    if (req.user.role === ROLES.VENDOR) {
        const hasItem = await OrderItem.exists({ order_id: order._id, vendor: req.user._id });
        if (!hasItem) throw new ApiError(403, 'Access denied. You have no items in this order.');
    }

    // 1. Verify OTP
    await verifyDeliveryOTP(orderId, otp);

    // 2. Mark items belonging to this vendor as delivered
    const updateFilter = { order_id: order._id };
    if (req.user.role === ROLES.VENDOR) {
        updateFilter.vendor = req.user._id;
    }
    
    await OrderItem.updateMany(
        updateFilter,
        { $set: { itemStatus: 'delivered' } }
    );

    // 3. Check if ALL items in the order are now delivered
    const allItems = await OrderItem.find({ order_id: order._id });
    const isFullyDelivered = allItems.every(item => item.itemStatus === 'delivered' || item.itemStatus === 'cancelled');

    if (isFullyDelivered) {
        await order.updateStatus(
            'delivered', 
            'All items delivered. Order completed via OTP verification.', 
            req.user.role === ROLES.ADMIN ? 'admin' : 'vendor'
        );
    } else {
        // Just add a history entry that this vendor's items were delivered
        order.statusHistory.push({
            status: order.status, // keep current status (probably 'out_for_delivery' or 'shipped')
            changedBy: req.user.role === ROLES.ADMIN ? 'admin' : 'vendor',
            note: `Items for ${req.user.role === ROLES.VENDOR ? 'vendor ' + req.user.fullName : 'admin'} delivered via OTP.`
        });
        await order.save();
    }

    res.status(200).json({
        success: true,
        message: isFullyDelivered 
            ? 'Order fully delivered successfully via OTP verification' 
            : 'Vendor items delivered successfully. Awaiting other items in this order.',
        data: { 
            order,
            isFullyDelivered
        }
    });
});

/**
 * @desc    Get all orders containing products from the current vendor
 * @route   GET /api/v1/orders/vendor/my-orders
 * @access  Private (Vendor)
 */
export const getVendorOrders = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const matchStage = { vendor: new mongoose.Types.ObjectId(req.user._id) };
    if (status) matchStage.itemStatus = status;

    const pipeline = [
        { $match: matchStage },
        {
            $lookup: {
                from: 'orders',
                localField: 'order_id',
                foreignField: '_id',
                as: 'order'
            }
        },
        { $unwind: '$order' },
        {
            $addFields: {
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
                        then: {
                            $ceil: {
                                $divide: [
                                    { $subtract: [new Date(), '$order.estimatedDelivery'] },
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
                data: [{ $skip: skip }, { $limit: limitNum }],
                total: [{ $count: 'count' }],
            },
        },
    ];

    const result = await OrderItem.aggregate(pipeline);
    const orders = result[0]?.data || [];
    const total = result[0]?.total?.[0]?.count || 0;

    res.status(200).json({
        success: true,
        count: orders.length,
        total,
        pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
        data: { orders },
    });
});

/**
 * @desc    Update tracking information for a specific order item
 * @route   PATCH /api/v1/orders/:orderId/items/:itemId/track
 * @access  Private (Vendor)
 */
export const updateItemTracking = asyncHandler(async (req, res) => {
    const { orderId, itemId } = req.params;
    const { trackingNumber, shippingCarrier, itemStatus } = req.body;

    const VALID_ITEM_STATUSES = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

    if (itemStatus && !VALID_ITEM_STATUSES.includes(itemStatus)) {
        throw new ApiError(400, `itemStatus must be one of: ${VALID_ITEM_STATUSES.join(', ')}`);
    }

    const item = await OrderItem.findById(itemId);
    if (!item || item.order_id.toString() !== orderId) throw new ApiError(404, 'Order item not found');

    if (item.vendor.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You can only update your own items');
    }

    if (trackingNumber) item.trackingNumber = trackingNumber;
    if (shippingCarrier) item.shippingCarrier = shippingCarrier;
    if (itemStatus) item.itemStatus = itemStatus;
    await item.save();

    const order = await Order.findById(orderId);
    const allItems = await OrderItem.find({ order_id: orderId });

    const allShipped = allItems.every(
        (i) => ['shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(i.itemStatus)
    );
    if (allShipped && order.status === 'processing') {
        order.status = 'shipped';
        order.statusHistory.push({ status: 'shipped', changedBy: 'vendor', note: 'All items shipped' });
        await order.save();
    }

    res.status(200).json({ success: true, message: 'Tracking updated', data: { item } });
},);

/**
 * @desc    Get all platform orders with advanced filters
 * @route   GET /api/v1/orders/admin/all
 * @access  Private (Admin)
 */
export const adminGetAllOrders = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, search, overdueOnly } = req.query;

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

/**
 * @desc    Cancel an order (Admin override)
 * @route   PATCH /api/v1/orders/:orderId/admin-cancel
 * @access  Private (Admin)
 */
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
            order.status = 'cancelled';
            order.cancelReason = reason;
            order.cancelledBy = 'admin';
            order.cancelledAt = new Date();
            order.adminNotes = `Admin override by ${req.user._id}: ${reason}`;

            order.statusHistory.push({
                status: 'cancelled',
                changedBy: 'admin',
                note: reason,
            });

            await order.save({ session });

            const items = await OrderItem.find({ order_id: order._id }).session(session);

            await Promise.all(
                items.map((item) =>
                    Product.findByIdAndUpdate(
                        item.product,
                        { $inc: { quantityAvailable: item.quantity } },
                        { session }
                    )
                )
            );

            // Also cancel all items
            await OrderItem.updateMany(
                { order_id: order._id },
                { $set: { itemStatus: 'cancelled', cancelReason: reason, cancelledAt: new Date() } },
                { session }
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

/**
 * @desc    Update order status (Admin override)
 * @route   PATCH /api/v1/orders/:orderId/admin-status
 * @access  Private (Admin)
 */
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