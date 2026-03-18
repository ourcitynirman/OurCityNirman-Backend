import crypto from 'crypto';
import mongoose from 'mongoose';
import { getRazorpay } from '../../config/razorpay.config.js';

import Order, { calcEstimatedDelivery } from '../../models/Order.model.js';
import Cart from '../../models/cart.model.js';
import Product from '../../models/Product.js';
import Address from '../../models/UserAddress.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';

const DELIVERY_CHARGE = 50;
const FREE_DELIVERY_ABOVE = 50_000;

function calcDeliveryCharge(subtotal) {
    return subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_CHARGE;
}

export const createRazorpayOrder = asyncHandler(async (req, res) => {
    const { addressId } = req.body;


    if (!addressId) throw new ApiError(400, 'Delivery address is required');

    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    console.log('Step 4: address found =', !!address);
    if (!address) throw new ApiError(404, 'Delivery address not found');

    const cart = await Cart.findOne({ user: req.user._id }).populate({
        path: 'items.product',
        select: 'name price images category brand quantityAvailable isActive vendorId',
    });
    console.log('Step 5: cart items    =', cart?.items?.length ?? 0);
    if (!cart || cart.items.length === 0) throw new ApiError(400, 'Your cart is empty');

    const orderItems = [];
    const categories = [];

    for (const item of cart.items) {
        const product = item.product;

        if (!product || !product.isActive) {
            throw new ApiError(400, 'One or more products in your cart are unavailable');
        }
        if (!product.vendorId) {
            throw new ApiError(400, `Vendor not found for "${product.name}"`);
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

        if (product.category) categories.push(product.category);
    }

    const subtotal = orderItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const deliveryCharge = calcDeliveryCharge(subtotal);
    const totalAmount = Math.round((subtotal + deliveryCharge) * 100) / 100;
    const estimatedDelivery = calcEstimatedDelivery(categories);
    const amountInPaise = Math.round(totalAmount * 100);

    console.log('Step 6: subtotal      =', subtotal);
    console.log('Step 6: deliveryCharge=', deliveryCharge);
    console.log('Step 6: totalAmount   =', totalAmount);
    console.log('Step 6: amountInPaise =', amountInPaise);

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

    let rzpOrder;
    try {
        rzpOrder = await getRazorpay().orders.create({
            amount: amountInPaise,
            currency: 'INR',
           receipt: `rcpt_${req.user._id.toString().slice(-8)}_${Date.now().toString().slice(-8)}`,
            notes: { userId: req.user._id.toString() },
        });
        console.log('Step 8: rzpOrder.id   =', rzpOrder?.id);
    } catch (rzpErr) {
       
        const msg =
            rzpErr?.error?.description ??
            rzpErr?.message ??
            'Razorpay order creation failed. Check your API keys.';

        throw new ApiError(502, msg);
    }

    console.log('Step 9: Saving order to DB ...');
    let dbOrder;
    try {
        dbOrder = await Order.create({
            user: req.user._id,
            items: orderItems,
            deliveryAddress,
            subtotal,
            deliveryCharge,
            totalAmount,
            paymentMethod: 'online',
            paymentStatus: 'pending',
            estimatedDelivery,
            razorpayOrderId: rzpOrder.id,
            statusHistory: [{
                status: 'placed',
                changedBy: 'user',
                note: 'Awaiting payment',
            }],
        });
    } catch (dbErr) {
        throw new ApiError(500, 'Failed to save order. Please try again.');
    }


    return res.status(200).json({
        success: true,
        data: {
            razorpayOrderId: rzpOrder.id,
            dbOrderId: dbOrder._id,
            amount: amountInPaise,
        },
    });
});

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
    const {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        dbOrderId,
    } = req.body;


    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !dbOrderId) {
        throw new ApiError(400, 'Payment verification data incomplete');
    }

    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');


    if (expectedSignature !== razorpay_signature) {
        await Order.findByIdAndUpdate(dbOrderId, {
            paymentStatus: 'failed',
            $push: {
                statusHistory: {
                    status: 'cancelled',
                    changedBy: 'system',
                    note: 'Payment signature verification failed',
                },
            },
        });
        throw new ApiError(400, 'Payment verification failed. Invalid signature.');
    }

    const order = await Order.findOne({
        _id: dbOrderId,
        user: req.user._id,
        paymentStatus: 'pending',
    });

    console.log('VERIFY Step 6: order found =', !!order);
    if (!order) throw new ApiError(404, 'Order not found or already processed');

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            order.paymentStatus = 'paid';
            order.razorpayPaymentId = razorpay_payment_id;
            order.status = 'confirmed';
            order.statusHistory.push({
                status: 'confirmed',
                changedBy: 'system',
                note: `Payment received. ID: ${razorpay_payment_id}`,
            });
            await order.save({ session });

            await Promise.all(
                order.items.map(({ product, quantity }) =>
                    Product.findByIdAndUpdate(
                        product,
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

    return res.status(200).json({
        success: true,
        message: 'Payment verified. Order confirmed.',
        data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            estimatedDelivery: order.estimatedDelivery,
        },
    });
});