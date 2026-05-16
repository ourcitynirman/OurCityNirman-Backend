import { Router } from "express";
import { upload } from "../../shared/middlewares/multer.middleware.js";
import { verifyJWT, authorize, requireVerification } from "../../shared/middlewares/auth.middleware.js";
import { ROLES } from "../../shared/constants/roles.js";
import { verifyDeliveryOTP } from "../../shared/services/delivery-otp.service.js";
import { asyncHandler } from "../../shared/utils/api.utils.js";
import {
    createShop,
    updateShop,
    deleteShop,
    deleteShopLogo,
    deleteShopBanner,
    toggleShopStatus,
    getMyShop,
    getAllShops,
    getShopById,
    getShopBySlug,
    getShopByCode,
    verifyShop,
    adminGetAllShops,
    adminGetShopStats,
    adminDeactivateShop,
    requestVerification,
    getMyVerificationStatus,
    getShopMetadata,
    adminGetVerificationRequests,
    adminGetVerificationDetail,
    // Vendor specific (Merged)
    getVendorDashboardStats,
    getInventoryReport,
    getVendorOrders,
    getVendorOrder,
    sendOrderDeliveryOTP,
    updateVendorOrderStatus,
    updateTracking
} from "./shop.controller.js";



const ShopRouter = Router();

// ─── Shared Middlewares ──────────────────────────────────────────────────────

const shopUpload = upload.fields([
    { name: "logo",          maxCount: 1 },
    { name: "banner",        maxCount: 1 },
    { name: "gstDocument",   maxCount: 1 },
    { name: "panDocument",   maxCount: 1 },
    { name: "shopPhoto",     maxCount: 1 },
    { name: "otherDocument", maxCount: 1 },
]);

const verificationUpload = upload.fields([
    { name: "gstDocument",   maxCount: 1 },
    { name: "panDocument",   maxCount: 1 },
    { name: "shopPhoto",     maxCount: 1 },
    { name: "otherDocument", maxCount: 1 },
]);

const requireDeliveryOtp = asyncHandler(async (req, res, next) => {
    if (req.body.status !== 'delivered') {
        req.otpVerified = false;
        return next();
    }
    try {
        const { otp } = req.body;
        const { id }  = req.params;
        if (!otp) return res.status(400).json({ success: false, message: 'OTP is required to mark order as delivered' });
        await verifyDeliveryOTP(id, otp);
        req.otpVerified = true;
        next();
    } catch (err) {
        next(err);
    }
});

// ─── Shop Router (Public & Basic Management) ────────────────────────────────

/**
 * @desc    Get all active shops with filtering and search
 * @route   GET /api/v1/shop/
 * @access  Public
 */
ShopRouter.get("/", getAllShops);

/**
 * @desc    Get common shop metadata (Store types, Finance options, Days)
 * @route   GET /api/v1/shop/metadata
 * @access  Public
 */
ShopRouter.get("/metadata", getShopMetadata);

/**
 * @desc    Get shop details by its unique slug
 * @route   GET /api/v1/shop/slug/:slug
 * @access  Public
 */
ShopRouter.get("/slug/:slug", getShopBySlug);

/**
 * @desc    Get shop details by its unique vendor code
 * @route   GET /api/v1/shop/code/:shopCode
 * @access  Public
 */
ShopRouter.get("/code/:shopCode", getShopByCode);

// --- PROTECTED SHOP ROUTES ---
ShopRouter.use(verifyJWT);

/**
 * @desc    Get shop details by ID
 * @route   GET /api/v1/shop/:shopId
 * @access  Private (Vendor/Admin)
 */
ShopRouter.get("/:shopId", getShopById);

/**
 * @desc    Update shop profile details
 * @route   PATCH /api/v1/shop/update/:shopId
 * @access  Private (Vendor/Admin)
 */
ShopRouter.patch("/update/:shopId", shopUpload, updateShop);

/**
 * @desc    Permanently delete a shop and its assets
 * @route   DELETE /api/v1/shop/delete/:shopId
 * @access  Private (Vendor/Admin)
 */
ShopRouter.delete("/delete/:shopId", deleteShop);

/**
 * @desc    Remove shop logo image
 * @route   DELETE /api/v1/shop/:shopId/logo
 * @access  Private (Vendor/Admin)
 */
ShopRouter.delete("/:shopId/logo", deleteShopLogo);

/**
 * @desc    Remove shop banner image
 * @route   DELETE /api/v1/shop/:shopId/banner
 * @access  Private (Vendor/Admin)
 */
ShopRouter.delete("/:shopId/banner", deleteShopBanner);

// ─── Vendor Router (Business Operations) ────────────────────────────────────

const VendorRouter = Router();
VendorRouter.use(verifyJWT);
VendorRouter.use(authorize(ROLES.VENDOR));

/**
 * @desc    Get real-time business statistics for the vendor dashboard
 * @route   GET /api/v1/vendor/dashboard/stats
 * @access  Private (Vendor)
 */
VendorRouter.get("/dashboard/stats", getVendorDashboardStats);

/**
 * @desc    Get comprehensive inventory status and low-stock reports
 * @route   GET /api/v1/vendor/inventory/report
 * @access  Private (Vendor)
 */
VendorRouter.get("/inventory/report", getInventoryReport);

/**
 * @desc    Get all orders containing products from the current vendor
 * @route   GET /api/v1/vendor/orders
 * @access  Private (Vendor)
 */
VendorRouter.get("/orders", getVendorOrders);

/**
 * @desc    Get full details of a specific order for the vendor
 * @route   GET /api/v1/vendor/orders/:id
 * @access  Private (Vendor)
 */
VendorRouter.get("/orders/:id", getVendorOrder);

/**
 * @desc    Send delivery confirmation OTP to customer
 * @route   POST /api/v1/vendor/orders/:id/send-otp
 * @access  Private (Vendor)
 */
VendorRouter.post("/orders/:id/send-otp", sendOrderDeliveryOTP);

/**
 * @desc    Update order status with transition logic and OTP verification for delivery
 * @route   PATCH /api/v1/vendor/orders/:id/status
 * @access  Private (Vendor)
 */
VendorRouter.patch("/orders/:id/status", requireDeliveryOtp, updateVendorOrderStatus);

/**
 * @desc    Update tracking info for a specific order item
 * @route   PATCH /api/v1/vendor/orders/:id/items/:itemId/track
 * @access  Private (Vendor)
 */
VendorRouter.patch("/orders/:id/items/:itemId/track", updateTracking);


/**
 * @desc    Get currently logged-in vendor's shop details
 * @route   GET /api/v1/vendor/my
 * @access  Private (Vendor)
 */
VendorRouter.get("/my", getMyShop);

/**
 * @desc    Register a new shop (Vendor initial setup)
 * @route   POST /api/v1/vendor/
 * @access  Private (Vendor)
 */
VendorRouter.post("/", shopUpload, createShop);

/**
 * @desc    Get current status of shop verification
 * @route   GET /api/v1/vendor/my/verification-status
 * @access  Private (Vendor)
 */
VendorRouter.get("/my/verification-status", getMyVerificationStatus);

/**
 * @desc    Submit documents for shop verification
 * @route   POST /api/v1/vendor/my/request-verification
 * @access  Private (Vendor)
 */
VendorRouter.post("/my/request-verification", verificationUpload, requestVerification);

/**
 * @desc    Toggle shop availability status
 * @route   PATCH /api/v1/vendor/:shopId/toggle-status
 * @access  Private (Vendor)
 */
VendorRouter.patch("/:shopId/toggle-status", toggleShopStatus);

// ─── Admin Shop Router (Management) ──────────────────────────────────────────

const AdminShopRouter = Router();
AdminShopRouter.use(verifyJWT);
AdminShopRouter.use(authorize(ROLES.ADMIN));

/**
 * @desc    Get comprehensive shop statistics (Admin dashboard)
 * @route   GET /api/v1/shop/admin/stats
 * @access  Private (Admin)
 */
AdminShopRouter.get("/stats", adminGetShopStats);

/**
 * @desc    Get list of all shops for administration
 * @route   GET /api/v1/shop/admin/all
 * @access  Private (Admin)
 */
AdminShopRouter.get("/all", adminGetAllShops);

/**
 * @desc    Get pending shop verification requests
 * @route   GET /api/v1/shop/admin/verification-requests
 * @access  Private (Admin)
 */
AdminShopRouter.get("/verification-requests", adminGetVerificationRequests);

/**
 * @desc    Get full details of a specific verification request
 * @route   GET /api/v1/shop/admin/verification-requests/:shopId
 * @access  Private (Admin)
 */
AdminShopRouter.get("/verification-requests/:shopId", adminGetVerificationDetail);

/**
 * @desc    Force deactivate a shop (Soft delete)
 * @route   PATCH /api/v1/shop/admin/:shopId/deactivate
 * @access  Private (Admin)
 */
AdminShopRouter.patch("/:shopId/deactivate", adminDeactivateShop);

/**
 * @desc    Approve or reject a shop verification request
 * @route   PATCH /api/v1/shop/:shopId/verify
 * @access  Private (Admin)
 */
AdminShopRouter.patch("/:shopId/verify", verifyShop);

export { ShopRouter, VendorRouter, AdminShopRouter };