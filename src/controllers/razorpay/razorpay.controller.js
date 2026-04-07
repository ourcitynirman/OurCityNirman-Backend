import crypto from 'crypto';
import mongoose from 'mongoose';
import { getRazorpay } from '../../config/razorpay.config.js';

import Order, { calcEstimatedDelivery } from '../../models/Order.model.js';
import Cart from '../../models/cart.model.js';
import Product from '../../models/Product.js';
import Address from '../../models/UserAddress.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import { createAndSendInvoice } from '../../services/invoice.service.js';

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

export const createRazorpayOrder = asyncHandler(async (req, res) => {
    const { addressId, deliveryType = 'standard' } = req.body;

    if (!addressId) throw new ApiError(400, 'Delivery address is required');

    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!address) throw new ApiError(404, 'Delivery address not found');

    const cart = await Cart.findOne({ user: req.user._id }).populate({
        path: 'items.product',
        select: 'name price images category brand quantityAvailable isActive vendorId',
    });
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
    const totalAmount = Math.round((totalSubtotal + totalDeliveryCharge) * 100) / 100;
    
    // adjust estimated delivery based on deliveryType
    let estimatedDelivery = calcEstimatedDelivery(categories);
    if (deliveryType === 'same_day') {
        estimatedDelivery = new Date(); // today
    } else if (deliveryType === 'express') {
        const d = new Date();
        d.setDate(d.getDate() + 2); // 2 days
        estimatedDelivery = d;
    }
    
    const amountInPaise = Math.round(totalAmount * 100);

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
    } catch (rzpErr) {
        throw new ApiError(502, 'Razorpay order creation failed. Check your API keys.');
    }

    const dbOrders = [];
    try {
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

            const newOrder = await Order.create({
                user: req.user._id,
                items: vItems,
                deliveryAddress,
                subtotal: vSubtotal,
                deliveryType,
                deliveryCharge: vDeliveryCharge,
                totalAmount: vTotalAmount,
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
            dbOrders.push(newOrder);
        }
    } catch (dbErr) {
        console.error("DEBUG: Order creation DB error:", dbErr);
        throw new ApiError(500, 'Failed to save orders. Please try again.');
    }


    return res.status(200).json({
        success: true,
        data: {
            razorpayOrderId: rzpOrder.id,
            dbOrderId: dbOrders[0]._id, // Returning the first for backward compatibility if needed, but the important one is razorpayOrderId
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

    const orders = await Order.find({
        razorpayOrderId: razorpay_order_id,
        user: req.user._id,
        paymentStatus: 'pending',
    });

    if (!orders || orders.length === 0) {
        throw new ApiError(404, 'No pending orders found for this payment');
    }

    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (expectedSignature !== razorpay_signature) {
        await Order.updateMany(
            { razorpayOrderId: razorpay_order_id },
            { 
                $set: { paymentStatus: 'failed' },
                $push: { 
                    statusHistory: {
                        status: 'cancelled',
                        changedBy: 'system',
                        note: 'Payment signature verification failed',
                    }
                }
            }
        );
        throw new ApiError(400, 'Payment verification failed. Invalid signature.');
    }

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            for(const order of orders) {
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
            }

            await Cart.findOneAndUpdate(
                { user: req.user._id },
                { $set: { items: [], totalPrice: 0, totalItems: 0 } },
                { session }
            );
        });

    } finally {
        session.endSession();
    }

    // Generate and send invoices for all orders (non-blocking)
    orders.forEach(order => {
        createAndSendInvoice(order, req.user)
            .catch(err => console.error(`Post-payment invoice job failed for ${order.orderNumber}:`, err));
    });

    return res.status(200).json({
        success: true,
        message: 'Payment verified. Order confirmed.',
        data: {
            orders: orders,
            orderNumber: orders.map(o => o.orderNumber).join(', '),
            estimatedDelivery: orders[0]?.estimatedDelivery,
        },
    });
});