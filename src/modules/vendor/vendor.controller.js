import OrderItem from '../orders/order-item.model.js';
import Product from '../products/product.model.js';
import Review from '../review/review.model.js';
import Shop from '../shop/shop.model.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import ApiResponse from '../../shared/utils/ApiResponse.js';
import ApiError from '../../shared/utils/ApiError.js';
import mongoose from 'mongoose';

/**
 * @desc    Get comprehensive stats for the vendor dashboard
 * @route   GET /api/v1/vendor/dashboard/stats
 * @access  Private (Vendor)
 */
export const getVendorDashboardStats = asyncHandler(async (req, res) => {
    const vendorId = req.user._id;

    // 1. Basic Counts & Revenue
    const stats = await OrderItem.aggregate([
        { $match: { vendor: new mongoose.Types.ObjectId(vendorId) } },
        {
            $group: {
                _id: null,
                totalRevenue: { 
                    $sum: { 
                        $cond: [
                            { $eq: ["$itemStatus", "delivered"] }, 
                            "$totalPrice", 
                            0 
                        ] 
                    } 
                },
                totalOrders: { $sum: 1 },
                pendingOrders: {
                    $sum: {
                        $cond: [
                            { $in: ["$itemStatus", ["pending", "confirmed", "processing"]] },
                            1,
                            0
                        ]
                    }
                },
                shippedOrders: {
                    $sum: {
                        $cond: [
                            { $eq: ["$itemStatus", "shipped"] },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const dashboardStats = stats[0] || {
        totalRevenue: 0,
        totalOrders: 0,
        pendingOrders: 0,
        shippedOrders: 0
    };

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
                        $cond: [
                            { $lte: ["$quantityAvailable", 5] },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const pStats = productStats[0] || {
        totalProducts: 0,
        activeProducts: 0,
        lowStockCount: 0
    };

    // 3. Low Stock Products Listing
    const lowStockProducts = await Product.find({
        vendorId,
        quantityAvailable: { $lte: 5 }
    })
    .select('name quantityAvailable price images')
    .limit(5)
    .lean();

    // 4. Recent Reviews (fix: Review has no 'vendor' field, must query via products)
    const vendorProductIds = await Product.find({ vendorId }).select('_id').lean();
    const productIdList = vendorProductIds.map(p => p._id);

    const recentReviews = await Review.find({
        productId: { $in: productIdList },
        status: 'active',
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'fullName profileImage')
    .populate('productId', 'name')
    .lean();

    // 5. Monthly Revenue (Last 6 Months)
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
                _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" }
                },
                revenue: { $sum: "$totalPrice" }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // 6. Shop Info
    const shop = await Shop.findOne({ vendor: vendorId }).select('shopname isVerified isActive rating');

    res.status(200).json(
        new ApiResponse(200, {
            overview: {
                ...dashboardStats,
                totalProducts: pStats.totalProducts,
                activeProducts: pStats.activeProducts,
                lowStockCount: pStats.lowStockCount
            },
            lowStockProducts,
            recentReviews,
            revenueHistory,
            shop
        }, "Vendor dashboard stats fetched successfully")
    );
});

/**
 * @desc    Get detailed inventory report for vendor
 * @route   GET /api/v1/vendor/inventory/report
 * @access  Private (Vendor)
 */
export const getInventoryReport = asyncHandler(async (req, res) => {
    const vendorId = req.user._id;

    const products = await Product.find({ vendorId })
        .select('name quantityAvailable price category brand isActive')
        .sort({ quantityAvailable: 1 })
        .lean();

    res.status(200).json(
        new ApiResponse(200, products, "Inventory report fetched successfully")
    );
});
