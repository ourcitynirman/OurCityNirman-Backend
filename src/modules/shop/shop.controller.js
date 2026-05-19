import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import ShopService from "./shop.service.js";
import Shop from "./shop.model.js";
import { 
    createShopSchema, 
    updateShopSchema, 
    shopIdParamSchema, 
    shopSlugParamSchema, 
    shopCodeParamSchema, 
    verifyShopSchema, 
    shopQuerySchema, 
    adminShopQuerySchema,
    vendorStatsQuerySchema,
    inventoryReportQuerySchema,
    vendorOrderQuerySchema,
    orderIdParamSchema,
    updateVendorOrderStatusSchema
} from "./shop.validation.js";
import Order from "../orders/order.model.js";
import { sendDeliveryOTP } from "../../shared/services/delivery-otp.service.js";
import { maskEmail } from "../../shared/utils/validation.utils.js";


/**
 * @desc    Register a new shop (Vendor initial setup)
 * @route   POST /api/v1/shop/
 * @access  Private (Vendor)
 */
export const createShop = asyncHandler(async (req, res) => {
    const validatedData = createShopSchema.parse(req.body);
    const shop = await ShopService.createShop(validatedData, req.user, req.files);
    return res.status(201).json(new ApiResponse(201, shop, "Shop created successfully."));
});

/**
 * @desc    Submit documents for shop verification
 * @route   POST /api/v1/shop/vendor/my/request-verification
 * @access  Private (Vendor)
 */
export const requestVerification = asyncHandler(async (req, res) => {
    const shop = await ShopService.requestVerification(req.user, req.files);
    return res.status(200).json(new ApiResponse(200, shop, "Verification request submitted successfully."));
});

/**
 * @desc    Get current status of shop verification
 * @route   GET /api/v1/shop/vendor/my/verification-status
 * @access  Private (Vendor)
 */
export const getMyVerificationStatus = asyncHandler(async (req, res) => {
    const shop = await ShopService.getMyVerificationStatus(req.user);
    return res.status(200).json(new ApiResponse(200, shop, "Verification status fetched"));
});

/**
 * @desc    Get common shop metadata
 * @route   GET /api/v1/shop/metadata
 * @access  Public
 */
export const getShopMetadata = asyncHandler(async (req, res) => {
    const storeTypes = Shop.schema.path("storeType").options.enum?.values || [];
    const financeOptions = Shop.schema.path("financeOptions").options.enum?.values || Shop.schema.path("financeOptions").caster?.options?.enum?.values || [];
    const days = Shop.schema.path("availability.daysOpen").options.enum?.values || Shop.schema.path("availability.daysOpen").caster?.options?.enum?.values || [];
    return res.status(200).json(new ApiResponse(200, { storeTypes, financeOptions, days }, "Shop metadata fetched successfully"));
});

/**
 * @desc    Update shop profile details
 */
export const updateShop = asyncHandler(async (req, res) => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const validatedData = updateShopSchema.parse(req.body);
    const shop = await ShopService.updateShop(shopId, validatedData, req.user, req.files);
    return res.status(200).json(new ApiResponse(200, shop, "Shop updated successfully"));
});

/**
 * @desc    Permanently delete a shop
 */
export const deleteShop = asyncHandler(async (req, res) => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    await ShopService.deleteShop(shopId, req.user);
    return res.status(200).json(new ApiResponse(200, {}, "Shop deleted successfully"));
});

/**
 * @desc    Remove shop logo
 */
export const deleteShopLogo = asyncHandler(async (req, res) => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const shop = await ShopService.deleteShopLogo(shopId, req.user);
    return res.status(200).json(new ApiResponse(200, shop, "Logo removed"));
});

/**
 * @desc    Remove shop banner
 */
export const deleteShopBanner = asyncHandler(async (req, res) => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const shop = await ShopService.deleteShopBanner(shopId, req.user);
    return res.status(200).json(new ApiResponse(200, shop, "Banner removed"));
});

/**
 * @desc    Toggle shop availability status
 */
export const toggleShopStatus = asyncHandler(async (req, res) => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const shop = await ShopService.toggleShopStatus(shopId, req.user);
    return res.status(200).json(new ApiResponse(200, shop, `Shop ${shop.isActive ? 'activated' : 'deactivated'}`));
});

/**
 * @desc    Get currently logged-in vendor's shop
 */
export const getMyShop = asyncHandler(async (req, res) => {
    const shop = await ShopService.getMyShop(req.user);
    return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
});

/**
 * @desc    Get all active shops
 */
export const getAllShops = asyncHandler(async (req, res) => {
    const queryData = shopQuerySchema.parse(req.query);
    const result = await ShopService.getAllShops(queryData);
    return res.status(200).json(new ApiResponse(200, result, "Shops fetched successfully"));
});

/**
 * @desc    Get shop by ID
 */
export const getShopById = asyncHandler(async (req, res) => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const shop = await ShopService.getShopById(shopId);
    return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
});

/**
 * @desc    Get shop by slug
 */
export const getShopBySlug = asyncHandler(async (req, res) => {
    const { slug } = shopSlugParamSchema.parse(req.params);
    const shop = await ShopService.getShopBySlug(slug);
    return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
});

/**
 * @desc    Get shop by code
 */
export const getShopByCode = asyncHandler(async (req, res) => {
    const { shopCode } = shopCodeParamSchema.parse(req.params);
    const shop = await ShopService.getShopByCode(shopCode);
    return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
});

/**
 * @desc    Get pending shop verification requests (Admin)
 */
export const adminGetVerificationRequests = asyncHandler(async (req, res) => {
    const queryData = adminShopQuerySchema.parse(req.query);
    const result = await ShopService.adminGetVerificationRequests(queryData);
    return res.status(200).json(new ApiResponse(200, result, "Requests fetched successfully"));
});

/**
 * @desc    Get verification details for a shop (Admin)
 */
export const adminGetVerificationDetail = asyncHandler(async (req, res) => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const shop = await ShopService.adminGetVerificationDetail(shopId);
    return res.status(200).json(new ApiResponse(200, shop, "Verification details fetched"));
});

/**
 * @desc    Verify shop (Admin)
 */
export const verifyShop = asyncHandler(async (req, res) => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const { action, reason } = verifyShopSchema.parse(req.body);
    const shop = await ShopService.verifyShop(shopId, action, reason, req.user);
    return res.status(200).json(new ApiResponse(200, shop, "Shop verification complete"));
});

/**
 * @desc    Get all shops (Admin)
 */
export const adminGetAllShops = asyncHandler(async (req, res) => {
    const queryData = adminShopQuerySchema.parse(req.query);
    const result = await ShopService.adminGetAllShops(queryData);
    return res.status(200).json(new ApiResponse(200, result, "All shops fetched"));
});

/**
 * @desc    Deactivate shop (Admin)
 */
export const adminDeactivateShop = asyncHandler(async (req, res) => {
    const { shopId } = shopIdParamSchema.parse(req.params);
    const shop = await ShopService.adminDeactivateShop(shopId);
    return res.status(200).json(new ApiResponse(200, shop, "Shop deactivated by admin"));
});

/**
 * @desc    Get shop statistics (Admin)
 */
export const adminGetShopStats = asyncHandler(async (req, res) => {
    const stats = await ShopService.adminGetShopStats();
    return res.status(200).json(new ApiResponse(200, stats, "Stats fetched successfully"));
});

// ─── Vendor specific controllers (Merged from Vendor/Order controllers) ──────
/**
 * @desc    Get comprehensive stats for the vendor dashboard
 */
export const getVendorDashboardStats = asyncHandler(async (req, res) => {
    const stats = await ShopService.getVendorDashboardStats(req.user._id);
    return res.status(200).json(new ApiResponse(200, stats, "Vendor dashboard stats fetched successfully"));
});

/**
 * @desc    Get detailed inventory report for vendor
 */
export const getInventoryReport = asyncHandler(async (req, res) => {
    const report = await ShopService.getInventoryReport(req.user._id);
    return res.status(200).json(new ApiResponse(200, report, "Inventory report fetched successfully"));
});

/**
 * @desc    Get all orders containing products from the current vendor
 */
export const getVendorOrders = asyncHandler(async (req, res) => {
    const queryData = vendorOrderQuerySchema.parse(req.query);
    const result = await ShopService.getVendorOrders(req.user._id, queryData);
    return res.status(200).json(new ApiResponse(200, result, "Vendor orders fetched successfully"));
});

/**
 * @desc    Get full details of a specific order for the vendor
 */
export const getVendorOrder = asyncHandler(async (req, res) => {
    const { id } = orderIdParamSchema.parse(req.params);
    const order = await ShopService.getVendorOrder(id, req.user._id);
    return res.status(200).json(new ApiResponse(200, { order }, "Vendor order fetched successfully"));
});

/**
 * @desc    Send delivery confirmation OTP to customer
 */
export const sendOrderDeliveryOTP = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await Order.findById(id).populate('user', 'email');
    if (!order) throw new ApiError(404, 'Order not found');

    await sendDeliveryOTP(id);

    return res.status(200).json(new ApiResponse(200, { sentTo: maskEmail(order.user.email) }, "Delivery OTP sent to customer's email"));
});

/**
 * @desc    Update order status for vendor items
 */
export const updateVendorOrderStatus = asyncHandler(async (req, res) => {
    const { id } = orderIdParamSchema.parse(req.params);
    const { status, note } = updateVendorOrderStatusSchema.parse(req.body);
    
    if (status === 'delivered' && !req.otpVerified) {
        throw new ApiError(403, 'OTP verification required to mark order as delivered');
    }

    const order = await ShopService.updateOrderStatus(id, req.user._id, status, note);
    return res.status(200).json(new ApiResponse(200, { order }, `Order status updated to ${status}`));
});

/**
 * @desc    Update tracking info for an order item
 */
export const updateTracking = asyncHandler(async (req, res) => {
    const { id, itemId } = req.params;
    const trackingData = req.body;
    const item = await ShopService.updateTracking(id, itemId, req.user._id, trackingData);
    return res.status(200).json(new ApiResponse(200, item, "Tracking information updated successfully"));
});