import mongoose from 'mongoose';
import Refund from './refund.model.js';
import Order from '../orders/order.model.js';
import { razorpay } from '../../shared/config/razorpay.config.js';
import { ApiError } from '../../shared/utils/api.utils.js';

class RefundService {
    static async processRefund(orderId, refundData) {
        const { reason, amount, notes } = refundData;

        const order = await Order.findById(orderId);
        if (!order) throw new ApiError(404, 'Order not found');

        if (order.paymentMethod !== 'online' || !order.razorpayPaymentId) {
            throw new ApiError(400, 'Only online payments can be refunded via Razorpay');
        }

        if (order.paymentStatus === 'refunded') throw new ApiError(400, 'Order already refunded');

        const refundAmount = amount || order.totalAmount;
        if (refundAmount > order.totalAmount) throw new ApiError(400, 'Refund amount exceeds order total');

        const session = await mongoose.startSession();
        let refundRecord;

        try {
            await session.withTransaction(async () => {
                [refundRecord] = await Refund.create([{
                    orderId: order._id, userId: order.user, razorpayPaymentId: order.razorpayPaymentId,
                    amount: refundAmount, reason, notes: notes || {}, status: 'pending'
                }], { session });

                const rzpRefund = await razorpay.refunds.create({
                    payment_id: order.razorpayPaymentId,
                    amount: Math.round(refundAmount * 100),
                    speed: 'normal',
                    notes: { orderNumber: order.orderNumber, reason, refundId: refundRecord._id.toString() }
                });

                refundRecord.razorpayRefundId = rzpRefund.id;
                refundRecord.status = 'processed';
                refundRecord.processedAt = new Date();
                await refundRecord.save({ session });

                order.status = 'refunded';
                order.paymentStatus = 'refunded';
                order.statusHistory.push({ status: 'refunded', changedBy: 'admin', note: `Refund of ₹${refundAmount} processed. ID: ${rzpRefund.id}` });
                await order.save({ session });
            });
        } catch (error) {
            throw new ApiError(500, error.description || error.message || 'Refund processing failed');
        } finally {
            session.endSession();
        }

        return refundRecord;
    }

    static async getRefundDetails(orderId) {
        const refund = await Refund.findOne({ orderId }).populate('orderId', 'orderNumber totalAmount status').lean();
        if (!refund) throw new ApiError(404, 'No refund record found');
        return refund;
    }
}

export default RefundService;
