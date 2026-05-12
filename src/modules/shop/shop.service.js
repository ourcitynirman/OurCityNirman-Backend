import mongoose from "mongoose";
import Shop from "./shop.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { generateVendorId } from "../../shared/utils/generator.utils.js";
import { ROLES } from "../../shared/constants/roles.js";
import OrderItem from "../orders/order-item.model.js";
import Product from "../products/product.model.js";
import Review from "../review/review.model.js";
import Order from "../orders/order.model.js";
import { sendDeliveryOTP } from "../../shared/services/delivery-otp.service.js";


const extractPublicId = (url) => {
    if (!url) return null;
    try {
        const afterUpload = url.split("/upload/")[1];
        if (!afterUpload) return null;
        return afterUpload.replace(/^v\d+\//, "").replace(/\.[^/.]+$/, "");
    } catch { return null; }
};

const safeDelete = async (url) => {
    const publicId = extractPublicId(url);
    if (!publicId) return;
    try { await deleteFromCloudinary(publicId); }
    catch (err) { console.warn(`[Cloudinary] Delete failed for "${publicId}":`, err.message); }
};

const uploadFile = async (localPath, folder) => {
    const result = await uploadOnCloudinary(localPath, { folder });
    const url = result?.secure_url || result?.url;
    if (!url) throw new ApiError(500, "Image upload failed — please try again");
    return url;
};

const VENDOR_SCALAR_FIELDS = ["shopname", "category", "storeType", "description", "tagline", "phone", "alternativephone", "website", "email", "gstNumber", "panNumber", "whatsapp"];

class ShopService {
    static async createShop(shopData, user, files) {
        if (user.role !== ROLES.VENDOR) throw new ApiError(403, "Only vendors can create a shop");

        const alreadyExists = await Shop.existsForVendor(user._id);
        if (alreadyExists) throw new ApiError(409, "You already have a shop.");

        const shopCode = await generateVendorId();

        let logoUrl = null;
        let bannerUrl = null;
        if (files?.logo?.[0]?.path) logoUrl = await uploadFile(files.logo[0].path, "shops/logos");
        if (files?.banner?.[0]?.path) bannerUrl = await uploadFile(files.banner[0].path, "shops/banners");

        const shop = await Shop.create({
            ...shopData,
            vendor: user._id,
            shopCode,
            logo: logoUrl,
            banner: bannerUrl,
            verificationHistory: [{ action: "requested", performedByRole: "system", note: "Shop created — awaiting verification request from vendor" }],
        });

        return shop;
    }

    static async requestVerification(user, files) {
        if (user.role !== ROLES.VENDOR) throw new ApiError(403, "Only vendors can request verification");

        const shop = await Shop.findByVendor(user._id);
        if (!shop) throw new ApiError(404, "You have not created a shop yet");

        if (shop.verificationStatus === "pending") {
            throw new ApiError(400, "Your verification request is already pending.");
        }

        if (shop.verificationStatus === "approved") {
            throw new ApiError(400, "Your shop is already verified.");
        }

        const gstPath = files?.gstDocument?.[0]?.path;
        const panPath = files?.panDocument?.[0]?.path;
        const otherPath = files?.otherDocument?.[0]?.path;

        if (!gstPath && !panPath) {
            throw new ApiError(400, "Please upload at least one document (GST or PAN) to request verification");
        }

        let gstUrl = shop.verificationDocs?.gstDocument || null;
        let panUrl = shop.verificationDocs?.panDocument || null;
        let otherUrl = shop.verificationDocs?.otherDocument || null;

        if (gstPath) {
            if (gstUrl) await safeDelete(gstUrl);  
            gstUrl = await uploadFile(gstPath, "shops/verification/gst");
        }
        if (panPath) {
            if (panUrl) await safeDelete(panUrl);
            panUrl = await uploadFile(panPath, "shops/verification/pan");
        }
        if (otherPath) {
            if (otherUrl) await safeDelete(otherUrl);
            otherUrl = await uploadFile(otherPath, "shops/verification/other");
        }

        const isReRequest = shop.verificationStatus === "rejected";
        const action = isReRequest ? "re_requested" : "requested";

        shop.verificationStatus = "pending";
        shop.verificationRequestedAt = new Date();
        shop.verificationResolvedAt = null;
        shop.verificationResolvedBy = null;
        shop.rejectionReason = null;
        shop.verificationAttempts = (shop.verificationAttempts || 0) + 1;
        shop.verificationDocs = { gstDocument: gstUrl, panDocument: panUrl, otherDocument: otherUrl, submittedAt: new Date() };

        shop.verificationHistory.push({
            action,
            performedBy: user._id,
            performedByRole: ROLES.VENDOR,
            note: isReRequest
                ? `Re-submitted after rejection (attempt #${shop.verificationAttempts})`
                : `Initial verification request (attempt #${shop.verificationAttempts})`,
        });

        await shop.save();
        return shop;
    }

    static async getMyVerificationStatus(user) {
        if (user.role !== ROLES.VENDOR) throw new ApiError(403, "Access denied");

        const shop = await Shop.findByVendor(user._id).select(
            "shopname verificationStatus verificationRequestedAt verificationResolvedAt rejectionReason verificationAttempts verificationDocs.submittedAt canRequestVerification"
        );
        return shop; // Returns null if not found
    }

    static async updateShop(shopId, updateData, user, files) {
        const shop = await Shop.findById(shopId);
        if (!shop) throw new ApiError(404, "Shop not found");

        if (user.role !== ROLES.ADMIN && shop.vendor.toString() !== user._id.toString()) {
            throw new ApiError(403, "Unauthorized");
        }

        VENDOR_SCALAR_FIELDS.forEach((f) => { if (updateData[f] !== undefined) shop[f] = updateData[f]; });

        if (updateData.address) { Object.assign(shop.address, updateData.address); shop.markModified("address"); }
        if (updateData.financeOptions) shop.financeOptions = updateData.financeOptions;
        if (updateData.deliveryAreas) shop.deliveryAreas = updateData.deliveryAreas;
        if (updateData.availability) { Object.assign(shop.availability, updateData.availability); shop.markModified("availability"); }
        if (updateData.bankDetails) { Object.assign(shop.bankDetails, updateData.bankDetails); shop.markModified("bankDetails"); }

        if (files?.logo?.[0]?.path) { await safeDelete(shop.logo); shop.logo = await uploadFile(files.logo[0].path, "shops/logos"); }
        if (files?.banner?.[0]?.path) { await safeDelete(shop.banner); shop.banner = await uploadFile(files.banner[0].path, "shops/banners"); }

        await shop.save();
        return shop;
    }

    static async deleteShop(shopId, user) {
        const shop = await Shop.findById(shopId);
        if (!shop) throw new ApiError(404, "Shop not found");

        if (user.role !== ROLES.ADMIN && shop.vendor.toString() !== user._id.toString()) {
            throw new ApiError(403, "Unauthorized");
        }

        await Promise.allSettled([
            safeDelete(shop.logo), safeDelete(shop.banner),
            safeDelete(shop.verificationDocs?.gstDocument),
            safeDelete(shop.verificationDocs?.panDocument),
            safeDelete(shop.verificationDocs?.otherDocument),
        ]);
        await Shop.findByIdAndDelete(shopId);
    }

    static async deleteShopLogo(shopId, user) {
        const shop = await Shop.findById(shopId);
        if (!shop) throw new ApiError(404, "Shop not found");

        if (user.role !== ROLES.ADMIN && shop.vendor.toString() !== user._id.toString()) {
            throw new ApiError(403, "Unauthorized");
        }

        if (shop.logo) {
            await safeDelete(shop.logo);
            shop.logo = null;
            await shop.save();
        }
        return shop;
    }

    static async deleteShopBanner(shopId, user) {
        const shop = await Shop.findById(shopId);
        if (!shop) throw new ApiError(404, "Shop not found");

        if (user.role !== ROLES.ADMIN && shop.vendor.toString() !== user._id.toString()) {
            throw new ApiError(403, "Unauthorized");
        }

        if (shop.banner) {
            await safeDelete(shop.banner);
            shop.banner = null;
            await shop.save();
        }
        return shop;
    }

    static async toggleShopStatus(shopId, user) {
        const shop = await Shop.findById(shopId);
        if (!shop) throw new ApiError(404, "Shop not found");

        if (user.role !== ROLES.ADMIN && shop.vendor.toString() !== user._id.toString()) {
            throw new ApiError(403, "Unauthorized");
        }

        shop.isActive = !shop.isActive;
        await shop.save();
        return shop;
    }

    static async adminDeactivateShop(shopId) {
        const shop = await Shop.findById(shopId);
        if (!shop) throw new ApiError(404, "Shop not found");

        shop.isActive = false;
        await shop.save();
        return shop;
    }

    static async adminGetVerificationDetail(shopId) {
        const shop = await Shop.findById(shopId)
            .populate("vendor", "fullName email phone avatar createdAt")
            .populate("category", "name slug icon")
            .populate("verificationResolvedBy", "fullName email");
        if (!shop) throw new ApiError(404, "Shop not found");
        return shop;
    }

    static async getMyShop(user) {
        const shop = await Shop.findByVendor(user._id)
            .populate("vendor", "fullName email avatar")
            .populate("category", "name slug icon");
        return shop; // Returns null if not found, which is cleaner than throwing 404
    }

    static async getAllShops(query) {
        const { category, isVerified, search, city, state, page, limit, sortBy, order } = query;

        const filter = { isActive: true };
        if (category) filter.category = category;
        if (isVerified !== undefined) filter.isVerified = isVerified === "true";
        if (city) filter["address.city"] = { $regex: city, $options: "i" };
        if (state) filter["address.state"] = { $regex: state, $options: "i" };
        if (search) {
            filter.$or = [
                { shopname: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { tagline: { $regex: search, $options: "i" } },
            ];
        }

        const [shops, total] = await Promise.all([
            Shop.find(filter)
                .populate("vendor", "fullName email avatar")
                .populate("category", "name slug icon")
                .sort({ [sortBy]: order === "asc" ? 1 : -1 })
                .skip((page - 1) * limit).limit(limit).lean(),
            Shop.countDocuments(filter),
        ]);

        return {
            shops,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 },
        };
    }

    static async getShopById(shopId) {
        const shop = await Shop.findById(shopId).populate("vendor", "fullName email avatar").populate("category", "name slug icon");
        if (!shop) throw new ApiError(404, "Shop not found");
        if (!shop.isActive) throw new ApiError(403, "This shop is currently inactive");
        return shop;
    }

    static async getShopBySlug(slug) {
        const shop = await Shop.findOne({ slug }).populate("vendor", "fullName email avatar").populate("category", "name slug icon");
        if (!shop) throw new ApiError(404, "Shop not found");
        if (!shop.isActive) throw new ApiError(403, "This shop is currently inactive");
        return shop;
    }

    static async getShopByCode(shopCode) {
        const shop = await Shop.findOne({ shopCode: shopCode.toUpperCase() }).populate("vendor", "fullName email avatar").populate("category", "name slug icon");
        if (!shop) throw new ApiError(404, "Shop not found");
        if (!shop.isActive) throw new ApiError(403, "This shop is currently inactive");
        return shop;
    }

    static async adminGetVerificationRequests(query) {
        const { status, page, limit } = query;

        let filter = {};
        if (!status || status === "all") {
            // "All" requests that are not "not_requested"
            filter.verificationStatus = { $in: ["pending", "approved", "rejected"] };
        } else {
            // Strict filter for specific status
            filter.verificationStatus = status;
        } 

        const [shops, total] = await Promise.all([
            Shop.find(filter)
                .populate("vendor", "fullName email phone createdAt")
                .populate("verificationResolvedBy", "fullName email")
                .populate("category", "name slug icon")
                .sort({ verificationRequestedAt: 1 }) 
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Shop.countDocuments(filter),
        ]);

        return {
            shops,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    static async verifyShop(shopId, action, reason, user) {
        const shop = await Shop.findById(shopId);
        if (!shop) throw new ApiError(404, "Shop not found");

        if (shop.verificationStatus !== "pending") {
            throw new ApiError(400, `Cannot ${action} — current status is ${shop.verificationStatus}`);
        }

        if (action === "approve") {
            shop.verificationStatus = "approved";
            shop.isVerified = true;
            shop.rejectionReason = null;
            shop.verificationResolvedAt = new Date();
            shop.verificationResolvedBy = user._id;
            shop.verificationHistory.push({ action: "approved", performedBy: user._id, performedByRole: ROLES.ADMIN, note: reason || "Approved by admin" });
        } else {
            shop.verificationStatus = "rejected";
            shop.isVerified = false;
            shop.rejectionReason = reason;
            shop.verificationResolvedAt = new Date();
            shop.verificationResolvedBy = user._id;
            shop.verificationHistory.push({ action: "rejected", performedBy: user._id, performedByRole: ROLES.ADMIN, note: reason });
        }

        await shop.save();
        return shop;
    }

    static async adminGetAllShops(query) {
        const { isActive, isVerified, category, verificationStatus, search, page, limit, sortBy, order } = query;

        const filter = {};
        if (isActive !== undefined) filter.isActive = isActive === "true";
        if (isVerified !== undefined) filter.isVerified = isVerified === "true";
        if (verificationStatus) filter.verificationStatus = verificationStatus;
        if (category) filter.category = category;
        if (search) {
            filter.$or = [{ shopname: { $regex: search, $options: "i" } }, { shopCode: { $regex: search, $options: "i" } }];
        }

        const [shops, total] = await Promise.all([
            Shop.find(filter)
                .populate("vendor", "fullName email phone avatar")
                .populate("category", "name slug icon")
                .sort({ [sortBy]: order === "asc" ? 1 : -1 })
                .skip((page - 1) * limit).limit(limit).lean(),
            Shop.countDocuments(filter),
        ]);

        return {
            shops,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    static async adminGetShopStats() {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const [result] = await Shop.aggregate([
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: 1 },
                                active: { $sum: { $cond: ["$isActive", 1, 0] } },
                                inactive: { $sum: { $cond: ["$isActive", 0, 1] } },
                                verified: { $sum: { $cond: ["$isVerified", 1, 0] } },
                                unverified: { $sum: { $cond: ["$isVerified", 0, 1] } },
                                pendingRequests: { $sum: { $cond: [{ $eq: ["$verificationStatus", "pending"] }, 1, 0] } },
                                approvedRequests: { $sum: { $cond: [{ $eq: ["$verificationStatus", "approved"] }, 1, 0] } },
                                rejectedRequests: { $sum: { $cond: [{ $eq: ["$verificationStatus", "rejected"] }, 1, 0] } },
                                notRequested: { $sum: { $cond: [{ $eq: ["$verificationStatus", "not_requested"] }, 1, 0] } },
                                totalOrders: { $sum: "$totalOrders" },
                                totalProducts: { $sum: "$totalProducts" },
                                avgRating: { $avg: "$rating.average" },
                            },
                        },
                        { $project: { _id: 0, total: 1, active: 1, inactive: 1, verified: 1, unverified: 1, pendingRequests: 1, approvedRequests: 1, rejectedRequests: 1, notRequested: 1, totalOrders: 1, totalProducts: 1, avgRating: { $round: ["$avgRating", 2] } } },
                    ],
                    byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $project: { _id: 0, category: "$_id", count: 1 } }],
                    byStoreType: [{ $group: { _id: "$storeType", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $project: { _id: 0, storeType: "$_id", count: 1 } }],
                    topByOrders: [{ $sort: { totalOrders: -1 } }, { $limit: 5 }, { $project: { shopname: 1, shopCode: 1, category: 1, totalOrders: 1, rating: 1 } }],
                    topByRating: [{ $match: { "rating.count": { $gte: 1 } } }, { $sort: { "rating.average": -1 } }, { $limit: 5 }, { $project: { shopname: 1, shopCode: 1, category: 1, rating: 1 } }],
                    recentShops: [{ $sort: { createdAt: -1 } }, { $limit: 5 }, { $project: { shopname: 1, shopCode: 1, category: 1, isVerified: 1, verificationStatus: 1, isActive: 1, createdAt: 1 } }],
                    recentPending: [{ $match: { verificationStatus: "pending" } }, { $sort: { verificationRequestedAt: 1 } }, { $limit: 5 }, { $project: { shopname: 1, shopCode: 1, category: 1, verificationRequestedAt: 1, verificationAttempts: 1 } }],
                    monthlyRegistrations: [
                        { $match: { createdAt: { $gte: sixMonthsAgo } } },
                        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
                        { $sort: { "_id.year": 1, "_id.month": 1 } },
                        { $project: { _id: 0, year: "$_id.year", month: "$_id.month", count: 1 } },
                    ],
                },
            },
        ]);

        return {
            totals: result.totals[0] ?? {},
            byCategory: result.byCategory,
            byStoreType: result.byStoreType,
            topByOrders: result.topByOrders,
            topByRating: result.topByRating,
            recentShops: result.recentShops,
            recentPending: result.recentPending,
            monthlyRegistrations: result.monthlyRegistrations,
        };
    }

    // ─── Vendor specific methods (Merged from VendorService) ───────────────────
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

        // 3. Category Mix
        const categoryMix = await Product.aggregate([
            { $match: { vendorId: new mongoose.Types.ObjectId(vendorId) } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // 4. Low Stock Products Listing

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
            totalRevenue: dashboardStats.totalRevenue || 0,
            totalOrders: dashboardStats.totalOrders || 0,
            pendingOrders: dashboardStats.pendingOrders || 0,
            shippedOrders: dashboardStats.shippedOrders || 0,
            liveProducts: pStats.activeProducts || 0,
            totalProducts: pStats.totalProducts || 0,
            lowStockCount: pStats.lowStockCount || 0,
            revenueChange: 0,
            ordersChange: 0,
            categoryMix: categoryMix.map(c => ({ name: c._id, value: c.count })),
            lowStockProducts,
            recentReviews,
            revenueChart: revenueHistory, 
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

    static async updateTracking(orderId, itemId, vendorId, trackingData) {
        const item = await OrderItem.findOne({ _id: itemId, order_id: orderId, vendor: vendorId });
        if (!item) throw new ApiError(404, "Order item not found or unauthorized");

        if (trackingData.trackingNumber) item.trackingNumber = trackingData.trackingNumber;
        if (trackingData.shippingCarrier) item.shippingCarrier = trackingData.shippingCarrier;

        await item.save();
        return item;
    }

}


export default ShopService;
