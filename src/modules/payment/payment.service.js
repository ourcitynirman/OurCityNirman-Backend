import crypto from 'crypto';
import mongoose from 'mongoose';
import { getRazorpay } from '../../shared/config/razorpay.config.js';
import Order, { calcEstimatedDelivery } from '../orders/order.model.js';
import OrderItem from '../orders/order-item.model.js';
import Cart from '../cart/cart.model.js';
import Product from '../products/product.model.js';
import Address from '../address/address.model.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import InvoiceService from '../invoice/invoice.service.js';
import Commission from '../orders/commission.model.js';

const DELIVERY_RATES = { standard: 0, express: 0, same_day: 0, pay_later: 0 };

function calcDeliveryCharge(subtotal, type = 'pay_later') {
    return 0;
}

class PaymentService {
    static async createRazorpayOrder(data, user) {
        const { addressId, deliveryType } = data;

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
        const categories = [];

        for (const item of cart.items) {
            const product = item.product;
            if (!product || !product.isActive) throw new ApiError(400, `Product "${product?.name || 'unknown'}" unavailable`);
            if (product.vendorId.toString() === user._id.toString()) throw new ApiError(400, `Cannot buy your own product: "${product.name}"`);
            if (product.quantityAvailable < item.quantity) throw new ApiError(400, `Insufficient stock for "${product.name}"`);

            orderItems.push({
                product: product._id,
                vendor: product.vendorId,
                productSnapshot: {
                    name: product.name,
                    image: (typeof product.images?.[0] === 'string' ? product.images[0] : (product.images?.[0]?.url || product.images?.[0]?.toObject?.()?.url || null)),
                    category: product.category?.name || product.category || null,
                    brand: product.brand?.name || product.brand || null,
                },
                quantity: item.quantity,
                price: product.price,
                totalPrice: product.price * item.quantity,
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
        const totalAmount = Math.round(totalSubtotal + totalDeliveryCharge);
        
        let estimatedDelivery = calcEstimatedDelivery(categories);
        if (deliveryType === 'same_day') estimatedDelivery = new Date();
        else if (deliveryType === 'express') {
            const d = new Date(); d.setDate(d.getDate() + 2); estimatedDelivery = d;
        }

        const amountInPaise = Math.round(totalAmount * 100);

        const deliveryAddress = {
            fullName: address.fullName, phone: address.phone, line1: address.line1, line2: address.line2,
            village: address.village, landmark: address.landmark, city: address.city, state: address.state,
            pincode: address.pincode, country: address.country || 'India',
        };

        const rzpOrder = await getRazorpay().orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `rcpt_${user._id.toString().slice(-8)}_${Date.now().toString().slice(-8)}`,
            notes: { userId: user._id.toString() },
        });

        const dbOrders = [];
        const vendorIds = Object.keys(itemsByVendor);
        let allocatedDeliveryCharge = 0;

        for (let i = 0; i < vendorIds.length; i++) {
            const vId = vendorIds[i];
            const vItems = itemsByVendor[vId];
            const vSubtotal = vItems.reduce((sum, item) => sum + item.totalPrice, 0);
            
            let vDeliveryCharge = (i === vendorIds.length - 1) 
                ? Math.max(0, totalDeliveryCharge - allocatedDeliveryCharge)
                : Math.round((vSubtotal / totalSubtotal) * totalDeliveryCharge);
            allocatedDeliveryCharge += vDeliveryCharge;

            const newOrder = await Order.create({
                user: user._id,
                deliveryAddress,
                subtotal: vSubtotal,
                deliveryType,
                deliveryCharge: vDeliveryCharge,
                totalAmount: Math.round(vSubtotal + vDeliveryCharge),
                paymentMethod: 'online',
                paymentStatus: 'pending',
                estimatedDelivery,
                razorpayOrderId: rzpOrder.id,
                statusHistory: [{ status: 'placed', changedBy: 'user', note: 'Awaiting payment' }],
            });

            await OrderItem.insertMany(vItems.map(item => ({
                order_id: newOrder._id, user_id: user._id, product: item.product, vendor: item.vendor,
                productSnapshot: item.productSnapshot, quantity: item.quantity, price: item.price,
                totalPrice: item.totalPrice, itemStatus: 'pending'
            })));

            dbOrders.push(newOrder);
        }

        return { razorpayOrderId: rzpOrder.id, dbOrderId: dbOrders[0]._id, amount: amountInPaise };
    }

    static async verifyRazorpayPayment(data, user) {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = data;

        const orders = await Order.find({ razorpayOrderId: razorpay_order_id, user: user._id, paymentStatus: 'pending' });
        if (!orders || orders.length === 0) throw new ApiError(404, 'No pending orders found');

        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');

        if (expectedSignature !== razorpay_signature) {
            await Order.updateMany({ razorpayOrderId: razorpay_order_id }, { 
                $set: { paymentStatus: 'failed' },
                $push: { statusHistory: { status: 'cancelled', changedBy: 'system', note: 'Signature verification failed' } }
            });
            throw new ApiError(400, 'Invalid signature');
        }

        const runUpdates = async (useSession) => {
            for(const order of orders) {
                order.paymentStatus = 'paid';
                order.razorpayPaymentId = razorpay_payment_id;
                order.status = 'confirmed';
                order.statusHistory.push({ status: 'confirmed', changedBy: 'system', note: `Paid. ID: ${razorpay_payment_id}` });
                if (useSession) {
                    await order.save({ session: useSession });
                } else {
                    await order.save();
                }

                let itemsQuery = OrderItem.find({ order_id: order._id });
                if (useSession) itemsQuery = itemsQuery.session(useSession);
                const items = await itemsQuery;

                await Promise.all(items.map(({ product, quantity }) => {
                    if (useSession) {
                        return Product.findByIdAndUpdate(product, { $inc: { quantityAvailable: -quantity } }).session(useSession);
                    } else {
                        return Product.findByIdAndUpdate(product, { $inc: { quantityAvailable: -quantity } });
                    }
                }));

                // Calculate 2% commission
                const commissionAmount = Math.round(order.subtotal * 0.02 * 100) / 100;
                const gstRate = 18;
                const gstAmount = Math.round(commissionAmount * 0.18 * 100) / 100;
                const totalCommission = commissionAmount + gstAmount;

                const firstVendor = items[0]?.vendor || order.vendor || null;

                const commissionData = {
                    order_id: order._id,
                    vendor_id: firstVendor,
                    commission_type: 'product',
                    commission_basis: 'percentage',
                    commission_rate: 2,
                    base_amount: order.subtotal,
                    commission_amount: commissionAmount,
                    gst_rate: gstRate,
                    gst_amount: gstAmount,
                    total_commission_amount: totalCommission,
                    payment_status: 'deducted',
                    remarks: 'Platform transaction commission (2%)'
                };

                if (useSession) {
                    await Commission.create([commissionData], { session: useSession });
                } else {
                    await Commission.create(commissionData);
                }
            }
            if (useSession) {
                await Cart.findOneAndUpdate({ user: user._id }, { $set: { items: [], totalPrice: 0, totalItems: 0 } }).session(useSession);
            } else {
                await Cart.findOneAndUpdate({ user: user._id }, { $set: { items: [], totalPrice: 0, totalItems: 0 } });
            }
        };

        try {
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    await runUpdates(session);
                });
            } catch (txErr) {
                const txMsg = (txErr.message || '').toLowerCase();
                const isTxError = !txErr.statusCode && (
                    txMsg.includes('transaction') ||
                    txMsg.includes('replica set') ||
                    txMsg.includes('not support') ||
                    txErr.codeName === 'TransactionSystemFailed' ||
                    txErr.name === 'MongoServerError'
                );
                if (isTxError) {
                    console.warn("MongoDB environment does not support transactions or failed, running updates fallback...", txErr.message);
                    await runUpdates(null);
                } else {
                    throw txErr;
                }
            } finally {
                session.endSession();
            }
        } catch (sessionErr) {
            console.warn("Failed to start session, running updates fallback...", sessionErr.message);
            await runUpdates(null);
        }

        orders.forEach(order => { InvoiceService.createAndSendInvoice(order, user).catch(err => console.error(`Invoice failed:`, err)); });

        return { orders, orderNumber: orders.map(o => o.orderNumber).join(', '), estimatedDelivery: orders[0]?.estimatedDelivery };
    }
}
 
export default PaymentService;
