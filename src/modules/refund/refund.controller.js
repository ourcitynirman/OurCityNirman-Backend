import Refund from './refund.model.js';
import Order from '../orders/order.model.js';
import { asyncHandler } from '../../shared/utils/api.utils.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { ApiResponse } from '../../shared/utils/api.utils.js';
import { razorpay } from '../../shared/config/razorpay.config.js';
import mongoose from 'mongoose';

/**
 * @desc    Process refund for an order via Razorpay
 * @route   POST /api/v1/refunds/:orderId
 * @access  Private (Admin)
 */
export const processRefund = asyncHandler(async (req, res) => {
    const { reason, amount, notes } = req.body;
    const { orderId } = req.params;

    if (!reason) throw new ApiError(400, 'Refund reason is required');

    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    if (order.paymentMethod !== 'online' || !order.razorpayPaymentId) {
        throw new ApiError(400, 'Only online payments with a valid Razorpay Payment ID can be refunded via this system.');
    }

    if (order.paymentStatus === 'refunded' || order.status === 'refunded') {
        throw new ApiError(400, 'Order is already refunded');
    }

    // Default to total amount if not provided
    const refundAmount = amount ? parseFloat(amount) : order.totalAmount;

    if (refundAmount > order.totalAmount) {
        throw new ApiError(400, 'Refund amount cannot exceed order total');
    }

    const session = await mongoose.startSession();
    let refundRecord;

    try {
        await session.withTransaction(async () => {
            // 1. Create local refund record
            [refundRecord] = await Refund.create([{
                orderId: order._id,
                userId: order.user,
                razorpayPaymentId: order.razorpayPaymentId,
                amount: refundAmount,
                reason,
                notes: notes || {},
                status: 'pending'
            }], { session });

            // 2. Call Razorpay API
            const rzpRefund = await razorpay.refunds.create({
                payment_id: order.razorpayPaymentId,
                amount: Math.round(refundAmount * 100), // Razorpay expects paise
                speed: 'normal',
                notes: {
                    orderNumber: order.orderNumber,
                    reason: reason,
                    refundId: refundRecord._id.toString()
                }
            });

            // 3. Update refund record
            refundRecord.razorpayRefundId = rzpRefund.id;
            refundRecord.status = 'processed';
            refundRecord.processedAt = new Date();
            await refundRecord.save({ session });

            // 4. Update Order status
            order.status = 'refunded';
            order.paymentStatus = 'refunded';
            order.statusHistory.push({
                status: 'refunded',
                changedBy: 'admin',
                note: `Refund of ₹${refundAmount} processed. ID: ${rzpRefund.id}`
            });
            await order.save({ session });
        });
    } catch (error) {
        console.error('[Refund Error]', error);
        throw new ApiError(500, error.description || error.message || 'Refund processing failed at Razorpay');
    } finally {
        session.endSession();
    }

    res.status(200).json(
        new ApiResponse(200, refundRecord, 'Refund processed successfully via Razorpay')
    );
});

/**
 * @desc    Get refund details for an order
 * @route   GET /api/v1/refunds/:orderId
 * @access  Private (Owner/Admin)
 */
export const getRefundDetails = asyncHandler(async (req, res) => {
    const refund = await Refund.findOne({ orderId: req.params.orderId })
        .populate('orderId', 'orderNumber totalAmount status')
        .lean();

    if (!refund) throw new ApiError(404, 'No refund record found for this order');

    res.status(200).json(
        new ApiResponse(200, refund, 'Refund details fetched successfully')
    );
});
