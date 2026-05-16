import { User } from '../auth/user.model.js';
import Product from '../products/product.model.js';
import Order from '../orders/order.model.js';
import OrderItem from '../orders/order-item.model.js';
import Shop from '../shop/shop.model.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { ROLES } from '../../shared/constants/roles.js';
import { createAuditLog } from '../../shared/utils/audit.utils.js';

class AdminService {
    static async getUsers(query) {
        const { page, limit, role, isActive, isVerified, search, sort } = query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (role) filter.role = role;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        const [users, total] = await Promise.all([
            User.find(filter).sort(sort).skip(skip).limit(limit).select('-password -refreshToken -__v').lean(),
            User.countDocuments(filter),
        ]);

        return { users, total, pagination: { page, limit, pages: Math.ceil(total / limit) } };
    }

    static async getUserById(userId) {
        const user = await User.findById(userId).select('-password -refreshToken -__v').lean();
        if (!user) throw new ApiError(404, 'User not found');

        const [orderCount, totalSpent] = await Promise.all([
            Order.countDocuments({ user: user._id }),
            Order.aggregate([
                { $match: { user: user._id, status: { $ne: 'cancelled' } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } },
            ]),
        ]);

        return { user, activity: { totalOrders: orderCount, totalSpent: totalSpent[0]?.total ?? 0 } };
    }

    static async blockUnblockUser(userId, admin, req) {
        const user = await User.findById(userId);
        if (!user) throw new ApiError(404, 'User not found');
        if (user._id.toString() === admin._id.toString()) throw new ApiError(400, 'You cannot block yourself');
        if (user.role === ROLES.ADMIN) throw new ApiError(403, 'Cannot block another admin');

        user.isActive = !user.isActive;
        await user.save();

        await createAuditLog(req, {
            action: user.isActive ? 'UNBLOCK_USER' : 'BLOCK_USER',
            resourceType: 'User',
            resourceId: user._id,
            details: `${user.isActive ? 'Unblocked' : 'Blocked'} account for ${user.email}`
        });

        return user;
    }

    static async deleteUser(userId, admin, req) {
        const user = await User.findById(userId);
        if (!user) throw new ApiError(404, 'User not found');
        if (user._id.toString() === admin._id.toString()) throw new ApiError(400, 'You cannot delete yourself');
        if (user.role === ROLES.ADMIN) throw new ApiError(403, 'Cannot delete another admin');

        const emailBefore = user.email;
        user.isActive = false;
        user.$isDeleted = true;
        user.email = `deleted_${user._id}@removed.com`;
        user.phone = null;
        await user.save();

        await createAuditLog(req, {
            action: 'DELETE_USER',
            resourceType: 'User',
            resourceId: user._id,
            details: `Soft-deleted user account: ${emailBefore}`
        });
    }

    static async getVendors(query) {
        const { page, limit, isActive, isVerified, search, sort } = query;
        const skip = (page - 1) * limit;

        const filter = { role: ROLES.VENDOR };
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
        if (search) {
            filter.$or = [{ fullName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
        }

        const [vendors, total] = await Promise.all([
            User.find(filter).sort(sort).skip(skip).limit(limit).select('-password -refreshToken -__v').lean(),
            User.countDocuments(filter),
        ]);

        const vendorIds = vendors.map((v) => v._id);
        const shops = await Shop.find({ vendor: { $in: vendorIds } }).select('vendor shopname isVerified isActive totalProducts totalOrders').lean();
        const shopMap = {};
        shops.forEach((s) => { shopMap[s.vendor.toString()] = s; });

        const enriched = vendors.map((v) => ({ ...v, shop: shopMap[v._id.toString()] ?? null }));
        return { vendors: enriched, total, pagination: { page, limit, pages: Math.ceil(total / limit) } };
    }

    static async verifyVendor(vendorId, req) {
        const user = await User.findOne({ _id: vendorId, role: ROLES.VENDOR });
        if (!user) throw new ApiError(404, 'Vendor not found');

        if (user.isVerified) return user;

        user.isVerified = true;
        await user.save();
        await Shop.findOneAndUpdate({ vendor: user._id }, { isVerified: true });

        await createAuditLog(req, {
            action: 'VERIFY_VENDOR',
            resourceType: 'User',
            resourceId: user._id,
            details: `Verified vendor account: ${user.email}`
        });

        return user;
    }

    static async blockVendor(vendorId, req) {
        const user = await User.findOne({ _id: vendorId, role: ROLES.VENDOR });
        if (!user) throw new ApiError(404, 'Vendor not found');

        user.isActive = !user.isActive;
        await user.save();
        
        // Also deactivate/activate their shop
        await Shop.findOneAndUpdate({ vendor: user._id }, { isActive: user.isActive });

        await createAuditLog(req, {
            action: user.isActive ? 'UNBLOCK_VENDOR' : 'BLOCK_VENDOR',
            resourceType: 'User',
            resourceId: user._id,
            details: `${user.isActive ? 'Unblocked' : 'Blocked'} vendor account: ${user.email}`
        });

        return user;
    }

    static async getAdminProducts(query) {
        const { page, limit, category, brand, vendorId, isActive, isApproved, isFeatured, search, sort } = query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (category) filter.category = category;
        if (brand) filter.brand = brand;
        if (vendorId) filter.vendorId = vendorId;
        
        // Handle boolean filters carefully
        if (isActive === 'true') filter.isActive = true;
        if (isActive === 'false') filter.isActive = false;
        
        // Handle status/approval filters
        if (isApproved === 'true' || isApproved === 'approved') filter.status = 'approved';
        else if (isApproved === 'false' || isApproved === 'pending') filter.status = 'pending';
        else if (isApproved === 'rejected') filter.status = 'rejected';
        else if (query.status) filter.status = query.status;

        if (isFeatured === 'true') filter.featured = true;
        if (query.trending === 'true') filter.trending = true;
        if (query.popular === 'true') filter.isPopular = true;

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .select('-reviews -__v')
                .populate('vendorId', 'fullName email')
                .populate('category', 'name slug')
                .populate('brand', 'name slug')
                .lean(),
            Product.countDocuments(filter),
        ]);

        return { products, total, pagination: { page, limit, pages: Math.ceil(total / limit) } };
    }

    static async approveProduct(productId, req) {
        const product = await Product.findById(productId);
        if (!product) throw new ApiError(404, 'Product not found');

        product.status = 'approved';
        product.isApproved = true;
        product.isActive = true;
        product.rejectionReason = null;
        await product.save();

        await createAuditLog(req, {
            action: 'APPROVE_PRODUCT',
            resourceType: 'Product',
            resourceId: product._id,
            details: `Approved product: ${product.name}`
        });

        return product;
    }

    static async rejectProduct(productId, reason, req) {
        const product = await Product.findById(productId);
        if (!product) throw new ApiError(404, 'Product not found');

        product.status = 'rejected';
        product.isApproved = false;
        product.isActive = false;
        product.rejectionReason = reason;
        await product.save();

        await createAuditLog(req, {
            action: 'REJECT_PRODUCT',
            resourceType: 'Product',
            resourceId: product._id,
            details: `Rejected product: ${product.name}. Reason: ${reason}`
        });

        return product;
    }

    static async updatePromotionalStatus(productId, type, value, req) {
        const product = await Product.findById(productId);
        if (!product) throw new ApiError(404, 'Product not found');

        if (type === 'featured') product.featured = value;
        else if (type === 'trending') product.trending = value;
        else if (type === 'popular') product.isPopular = value;
        
        await product.save();

        await createAuditLog(req, {
            action: 'UPDATE_PROMOTIONAL',
            resourceType: 'Product',
            resourceId: product._id,
            details: `Updated ${type} to ${value} for ${product.name}`
        });

        return product;
    }

    static async bulkApproveProducts(productIds, req) {
        const result = await Product.updateMany(
            { _id: { $in: productIds } },
            { $set: { status: 'approved', isApproved: true, isActive: true, rejectionReason: null } }
        );

        await createAuditLog(req, {
            action: 'BULK_APPROVE_PRODUCTS',
            resourceType: 'Product',
            resourceId: null,
            details: `Approved ${result.modifiedCount} products in bulk`
        });

        return result;
    }

    static async blockProduct(productId, reason, req) {
        const product = await Product.findById(productId);
        if (!product) throw new ApiError(404, 'Product not found');

        product.isActive = false;
        product.isApproved = false;
        if (reason) product.blockReason = reason;
        await product.save();

        await createAuditLog(req, {
            action: 'BLOCK_PRODUCT',
            resourceType: 'Product',
            resourceId: product._id,
            details: `Blocked product: ${product.name}. Reason: ${reason || 'Not specified'}`
        });

        return product;
    }

    static async getAdminOrders(query) {
        const { page, limit, status, paymentStatus, paymentMethod, userId, vendorId, startDate, endDate, sort } = query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (status) filter.status = status;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (paymentMethod) filter.paymentMethod = paymentMethod;
        if (userId) filter.user = userId;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }
        if (vendorId) {
            const vendorOrderItems = await OrderItem.find({ vendor: vendorId }).select('order_id').lean();
            filter._id = { $in: vendorOrderItems.map((oi) => oi.order_id) };
        }

        const [orders, total] = await Promise.all([
            Order.find(filter).sort(sort).skip(skip).limit(limit).populate('user', 'fullName email phone').select('-statusHistory -__v').lean(),
            Order.countDocuments(filter),
        ]);

        return { orders, total, pagination: { page, limit, pages: Math.ceil(total / limit) } };
    }

    static async getAdminOrderById(orderId) {
        const order = await Order.findById(orderId).populate('user', 'fullName email phone').lean();
        if (!order) throw new ApiError(404, 'Order not found');

        const items = await OrderItem.getByOrder(order._id);
        order.items = items;
        return order;
    }

    static async overrideOrderStatus(orderId, status, note) {
        const order = await Order.findById(orderId);
        if (!order) throw new ApiError(404, 'Order not found');

        order.status = status;
        if (status === 'delivered') {
            order.deliveredAt = new Date();
            if (order.paymentMethod === 'cod') order.paymentStatus = 'paid';
        }
        if (status === 'cancelled') {
            order.cancelReason = note || 'Cancelled by admin';
            order.cancelledAt = new Date();
        }

        await order.save();
        return order;
    }

    static async getDashboardStats() {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const [
            totalUsers, totalVendors, activeUsers, totalProducts, pendingApproval, totalOrders, monthlyOrders,
            revenuePipeline, monthlyRevenuePipeline, ordersByStatus,
        ] = await Promise.all([
            User.countDocuments({ role: { $ne: ROLES.ADMIN } }),
            User.countDocuments({ role: ROLES.VENDOR }),
            User.countDocuments({ isActive: true, role: { $ne: ROLES.ADMIN } }),
            Product.countDocuments({ isActive: true }),
            Product.countDocuments({ isApproved: false, isActive: true }),
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Order.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            Order.aggregate([{ $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        ]);

        const last6Months = await Order.aggregate([
            { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: new Date(today.getFullYear(), today.getMonth() - 5, 1) } } },
            { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        const statusMap = {};
        ordersByStatus.forEach(({ _id, count }) => { statusMap[_id] = count; });

        return {
            users: { total: totalUsers, active: activeUsers, vendors: totalVendors },
            products: { total: totalProducts, pendingApproval },
            orders: { total: totalOrders, thisMonth: monthlyOrders, byStatus: statusMap },
            revenue: { total: revenuePipeline[0]?.total ?? 0, thisMonth: monthlyRevenuePipeline[0]?.total ?? 0, last6Months },
        };
    }

    static async getFinancialReport(query) {
        const { startDate, endDate } = query;
        const filter = { status: 'delivered' };
        if (startDate || endDate) {
            filter.deliveredAt = {};
            if (startDate) filter.deliveredAt.$gte = new Date(startDate);
            if (endDate) filter.deliveredAt.$lte = new Date(endDate);
        }

        const stats = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalAmount' },
                    totalSubtotal: { $sum: '$subtotal' },
                    totalDeliveryCharges: { $sum: '$deliveryCharge' },
                    orderCount: { $sum: 1 },
                    avgOrderValue: { $avg: '$totalAmount' }
                }
            }
        ]);

        const vendorPerformance = await OrderItem.aggregate([
            { $match: { itemStatus: 'delivered', ...(startDate || endDate ? { createdAt: filter.deliveredAt } : {}) } },
            {
                $group: {
                    _id: '$vendor',
                    revenue: { $sum: '$totalPrice' },
                    itemsSold: { $sum: '$quantity' }
                }
            },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'vendor' } },
            { $unwind: '$vendor' },
            { $project: { _id: 1, revenue: 1, itemsSold: 1, vendorName: '$vendor.fullName', vendorEmail: '$vendor.email' } },
            { $sort: { revenue: -1 } },
            { $limit: 10 }
        ]);

        return {
            summary: stats[0] || { totalRevenue: 0, totalSubtotal: 0, totalDeliveryCharges: 0, orderCount: 0, avgOrderValue: 0 },
            topVendors: vendorPerformance
        };
    }
}

export default AdminService;
