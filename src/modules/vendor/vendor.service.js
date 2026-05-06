import mongoose from 'mongoose';
import OrderItem from '../orders/order-item.model.js';
import Product from '../products/product.model.js';
import Review from '../review/review.model.js';
import Shop from '../shop/shop.model.js';
import Order from '../orders/order.model.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { sendDeliveryOTP } from '../../shared/services/delivery-otp.service.js';

class VendorService {
    static async getVendorDashboardStats(vendorId) {
        // 1. Basic Counts & Revenue
        const stats = await OrderItem.aggregate([
            { $match: { vendor: new mongoose.Types.ObjectId(vendorId) } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { 
                        $sum: { 
                            $cond: [{ $eq: ["$itemStatus", "delivered"] }, "$totalPrice", 0] 
                        } 
                    },
                    totalOrders: { $sum: 1 },
                    pendingOrders: {
                        $sum: {
                            $cond: [{ $in: ["$itemStatus", ["pending", "confirmed", "processing"]] }, 1, 0]
                        }
                    },
                    shippedOrders: {
                        $sum: {
                            $cond: [{ $eq: ["$itemStatus", "shipped"] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const dashboardStats = stats[0] || { totalRevenue: 0, totalOrders: 0, pendingOrders: 0, shippedOrders: 0 };

        // 2. Product Stats
        const productStats = await Product.aggregate([
            { $match: { vendorId: new mongoose.Types.ObjectId(vendorId) } },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    activeProducts: { $sum: { $cond: ["$isActive", 1, 0] } },
                    lowStockCount: {
                        $sum: {
                            $cond: [{ $lte: ["$quantityAvailable", 5] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const pStats = productStats[0] || { totalProducts: 0, activeProducts: 0, lowStockCount: 0 };

        // 3. Low Stock Products Listing
        const lowStockProducts = await Product.find({ vendorId, quantityAvailable: { $lte: 5 } })
            .select('name quantityAvailable price images')
            .limit(5)
            .lean();

        // 4. Recent Reviews
        const vendorProductIds = await Product.find({ vendorId }).select('_id').lean();
        const productIdList = vendorProductIds.map(p => p._id);

        const recentReviews = await Review.find({ productId: { $in: productIdList }, status: 'active' })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('userId', 'fullName profileImage')
            .populate('productId', 'name')
            .lean();

        // 5. Monthly Revenue
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);

        const revenueHistory = await OrderItem.aggregate([
            {
                $match: {
                    vendor: new mongoose.Types.ObjectId(vendorId),
                    itemStatus: 'delivered',
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
                    revenue: { $sum: "$totalPrice" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // 6. Shop Info
        const shop = await Shop.findOne({ vendor: vendorId }).select('shopname isVerified isActive rating');

        return {
            overview: { ...dashboardStats, totalProducts: pStats.totalProducts, activeProducts: pStats.activeProducts, lowStockCount: pStats.lowStockCount },
            lowStockProducts,
            recentReviews,
            revenueHistory,
            shop
        };
    }

    static async getInventoryReport(vendorId) {
        return await Product.find({ vendorId })
            .select('name quantityAvailable price category brand isActive')
            .sort({ quantityAvailable: 1 })
            .lean();
    }

    static async getVendorOrders(vendorId, query) {
        const { page = 1, limit = 10, status } = query;
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

        const filter = { vendor: vendorId, ...(status ? { itemStatus: status } : {}) };

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
            _id: item.order_id?._id,
            items: [item],
        }));

        return {
            orders: enriched,
            total,
            pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
        };
    }

    static async getVendorOrder(orderId, vendorId) {
        const order = await Order.findById(orderId).lean();
        if (!order) throw new ApiError(404, 'Order not found');

        const items = await OrderItem.find({ order_id: orderId, vendor: vendorId }).populate('product', 'name price images');
        order.items = items;
        return order;
    }

    static async updateOrderStatus(orderId, vendorId, status, note) {
        const order = await Order.findById(orderId);
        if (!order) throw new ApiError(404, 'Order not found');

        const vendorItems = await OrderItem.find({ order_id: order._id, vendor: vendorId });
        if (vendorItems.length === 0) throw new ApiError(403, 'Access denied');

        if (order.status === 'cancelled') throw new ApiError(400, 'Cannot update cancelled order');

        await order.updateStatus(status, note || null, 'vendor');

        if (status === 'out_for_delivery') {
            sendDeliveryOTP(order._id).catch(err => console.error(`[OTP] Send failed:`, err.message));
        }

        if (status === 'delivered') {
            order.deliveredAt = new Date();
            if (order.paymentMethod === 'cod') order.paymentStatus = 'paid';
            await order.save();
        }

        await OrderItem.updateMany({ order_id: order._id, vendor: vendorId }, { $set: { itemStatus: status } });
        return order;
    }
}

export default VendorService;
