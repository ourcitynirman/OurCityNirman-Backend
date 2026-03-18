import { User } from '../../models/user.model.js';
import Product from '../../models/Product.js';
import Order from '../../models/Order.model.js';
import Shop from '../../models/shop.model.js';
import ApiError from '../../utils/ApiError.js';
import asyncHandler from '../../utils/asyncHandler.js';



function safePaginate(page, limit, maxLimit = 100) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(maxLimit, Math.max(1, parseInt(limit) || 10));
    return { pageNum: p, limitNum: l, skip: (p - 1) * l };
}



const getUsers = asyncHandler(async (req, res) => {
    const {
        page = 1, limit = 10,
        role, isActive, isVerified,
        search, sort = '-createdAt',
    } = req.query;

    const { pageNum, limitNum, skip } = safePaginate(page, limit);
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
        User.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .select('-password -refreshToken -__v')
            .lean(),
        User.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        count: users.length, total,
        pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
        data: { users },
    });
});



const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
        .select('-password -refreshToken -__v')
        .lean();

    if (!user) throw new ApiError(404, 'User not found');


    const [orderCount, totalSpent] = await Promise.all([
        Order.countDocuments({ user: user._id }),
        Order.aggregate([
            { $match: { user: user._id, status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
    ]);

    res.status(200).json({
        success: true,
        data: {
            user,
            activity: {
                totalOrders: orderCount,
                totalSpent: totalSpent[0]?.total ?? 0,
            },
        },
    });
});



const blockUnblockUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');


    if (user._id.toString() === req.user._id.toString()) {
        throw new ApiError(400, 'You cannot block your own account');
    }


    if (user.role === 'admin') {
        throw new ApiError(403, 'Cannot block another admin');
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
        success: true,
        message: `User ${user.isActive ? 'unblocked' : 'blocked'} successfully`,
        data: { userId: user._id, isActive: user.isActive },
    });
});



// Soft delete
const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');

    if (user._id.toString() === req.user._id.toString()) {
        throw new ApiError(400, 'You cannot delete your own account');
    }
    if (user.role === 'admin') {
        throw new ApiError(403, 'Cannot delete another admin');
    }

    user.isActive = false;
    user.$isDeleted = true;
    user.email = `deleted_${user._id}@removed.com`;
    user.phone = null;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'User deleted successfully',
        data: { deletedId: req.params.id },
    });
});



//  VENDORS
const getVendors = asyncHandler(async (req, res) => {
    const {
        page = 1, limit = 10,
        isActive, isVerified,
        search, sort = '-createdAt',
    } = req.query;

    const { pageNum, limitNum, skip } = safePaginate(page, limit);
    const filter = { role: 'vendor' };

    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';

    if (search) {
        filter.$or = [
            { fullName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }

    const [vendors, total] = await Promise.all([
        User.find(filter)
            .sort(sort).skip(skip).limit(limitNum)
            .select('-password -refreshToken -__v')
            .lean(),
        User.countDocuments(filter),
    ]);


    const vendorIds = vendors.map((v) => v._id);
    const shops = await Shop.find({ vendor: { $in: vendorIds } })
        .select('vendor name isVerified isActive totalProducts totalOrders')
        .lean();

    const shopMap = {};
    shops.forEach((s) => { shopMap[s.vendor.toString()] = s; });

    const enriched = vendors.map((v) => ({
        ...v,
        shop: shopMap[v._id.toString()] ?? null,
    }));

    res.status(200).json({
        success: true,
        count: enriched.length, total,
        pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
        data: { vendors: enriched },
    });
});



const verifyVendor = asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: 'vendor' });
    if (!user) throw new ApiError(404, 'Vendor not found');

    if (user.isVerified) {
        return res.status(200).json({
            success: true,
            message: 'Vendor is already verified',
            data: { userId: user._id, isVerified: true },
        });
    }

    user.isVerified = true;
    await user.save();


    await Shop.findOneAndUpdate(
        { vendor: user._id },
        { isVerified: true }
    );

    res.status(200).json({
        success: true,
        message: 'Vendor verified successfully',
        data: { userId: user._id, isVerified: true },
    });
});



const blockVendor = asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: 'vendor' });
    if (!user) throw new ApiError(404, 'Vendor not found');

    user.isActive = !user.isActive;
    await user.save();


    await Shop.findOneAndUpdate(
        { vendor: user._id },
        { isActive: user.isActive }
    );

    res.status(200).json({
        success: true,
        message: `Vendor ${user.isActive ? 'unblocked' : 'blocked'} successfully`,
        data: { userId: user._id, isActive: user.isActive },
    });
});



//  PRODUCTS
const getAdminProducts = asyncHandler(async (req, res) => {
    const {
        page = 1, limit = 10,
        category, brand, vendorId,
        isActive, isApproved, isFeatured,
        search, sort = '-createdAt',
    } = req.query;

    const { pageNum, limitNum, skip } = safePaginate(page, limit);
    const filter = {};

    if (category) filter.category = { $regex: category, $options: 'i' };
    if (brand) filter.brand = { $regex: brand, $options: 'i' };
    if (vendorId) filter.vendorId = vendorId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
    if (isFeatured !== undefined) filter.featured = isFeatured === 'true';

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
            { category: { $regex: search, $options: 'i' } },
        ];
    }

    const [products, total] = await Promise.all([
        Product.find(filter)
            .sort(sort).skip(skip).limit(limitNum)
            .select('-reviews -__v')
            .populate('vendorId', 'fullName email')
            .lean(),
        Product.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        count: products.length, total,
        pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
        data: { products },
    });
});



const approveProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found');

    if (product.isApproved) {
        return res.status(200).json({
            success: true,
            message: 'Product is already approved',
        });
    }

    product.isApproved = true;
    product.isActive = true;
    await product.save();

    res.status(200).json({
        success: true,
        message: 'Product approved successfully',
        data: { productId: product._id, isApproved: true },
    });
});



const blockProduct = asyncHandler(async (req, res) => {
    const { reason = '' } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found');

    product.isActive = false;
    product.isApproved = false;
    if (reason) product.blockReason = reason;
    await product.save();

    res.status(200).json({
        success: true,
        message: 'Product blocked successfully',
        data: { productId: product._id, isActive: false },
    });
});



//  ORDERS
const getAdminOrders = asyncHandler(async (req, res) => {
    const {
        page = 1, limit = 10,
        status, paymentStatus, paymentMethod,
        userId, vendorId,
        startDate, endDate,
        sort = '-createdAt',
    } = req.query;

    const { pageNum, limitNum, skip } = safePaginate(page, limit);
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
        const vendorProducts = await Product.find({ vendorId }, '_id').lean();
        const pIds = vendorProducts.map((p) => p._id);
        filter['items.product'] = { $in: pIds };
    }

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .sort(sort).skip(skip).limit(limitNum)
            .populate('user', 'fullName email phone')
            .select('-statusHistory -__v')
            .lean(),
        Order.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        count: orders.length, total,
        pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
        data: { orders },
    });
});



const getAdminOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('user', 'fullName email phone')
        .populate('items.product', 'name price images vendorId');

    if (!order) throw new ApiError(404, 'Order not found');

    res.status(200).json({
        success: true,
        data: { order },
    });
});



const overrideOrderStatus = asyncHandler(async (req, res) => {
    const { status, note = '' } = req.body;

    const VALID_STATUSES = ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!status) throw new ApiError(400, 'status is required');
    if (!VALID_STATUSES.includes(status)) {
        throw new ApiError(400, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const order = await Order.findById(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found');

    const prevStatus = order.status;
    order.status = status;

    if (status === 'delivered') {
        order.deliveredAt = new Date();
        order.paymentStatus = order.paymentMethod === 'cod' ? 'paid' : order.paymentStatus;
    }

    if (status === 'cancelled') {
        order.cancelReason = note || 'Cancelled by admin';
        order.cancelledAt = new Date();
    }

    await order.save();

    res.status(200).json({
        success: true,
        message: `Order status changed from "${prevStatus}" to "${status}"`,
        data: { order },
    });
});





//  DASHBOARD STATS  
const getDashboardStats = asyncHandler(async (req, res) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
        totalUsers,
        totalVendors,
        activeUsers,
        totalProducts,
        pendingApproval,
        totalOrders,
        monthlyOrders,
        revenuePipeline,
        monthlyRevenuePipeline,
        ordersByStatus,
    ] = await Promise.all([

        User.countDocuments({ role: { $ne: 'admin' } }),

        User.countDocuments({ role: 'vendor' }),

        User.countDocuments({ isActive: true, role: { $ne: 'admin' } }),


        Product.countDocuments({ isActive: true }),

        Product.countDocuments({ isApproved: false, isActive: true }),


        Order.countDocuments(),

        Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
        


        Order.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),


        Order.aggregate([
            { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),


        Order.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
    ]);


    const last6Months = await Order.aggregate([
        {
            $match: {
                status: { $ne: 'cancelled' },
                createdAt: { $gte: new Date(today.getFullYear(), today.getMonth() - 5, 1) },
            },
        },
        {
            $group: {
                _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                revenue: { $sum: '$totalAmount' },
                orders: { $sum: 1 },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const statusMap = {};
    ordersByStatus.forEach(({ _id, count }) => { statusMap[_id] = count; });

    res.status(200).json({
        success: true,
        data: {
            users: {
                total: totalUsers,
                active: activeUsers,
                vendors: totalVendors,
            },
            products: {
                total: totalProducts,
                pendingApproval,
            },
            orders: {
                total: totalOrders,
                thisMonth: monthlyOrders,
                byStatus: statusMap,
            },
            revenue: {
                total: revenuePipeline[0]?.total ?? 0,
                thisMonth: monthlyRevenuePipeline[0]?.total ?? 0,
                last6Months,
            },
        },
    });
});





export {
    getUsers,
    getUserById,
    blockUnblockUser,
    deleteUser,
    getVendors,
    verifyVendor,
    blockVendor,
    getAdminProducts,
    approveProduct,
    blockProduct,
    getAdminOrders,
    getAdminOrderById,
    overrideOrderStatus,
    getDashboardStats,
};