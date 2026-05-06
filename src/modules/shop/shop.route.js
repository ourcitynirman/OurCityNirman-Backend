import { Router } from "express";
import { upload } from "../../shared/middlewares/multer.middleware.js";
import { verifyJWT } from "../../shared/middlewares/auth.middleware.js";
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
} from "./shop.controller.js";

const ShopRouter = Router();

// --- UPLOAD CONFIGURATIONS ---

const shopUpload = upload.fields([
    { name: "logo",   maxCount: 1 },
    { name: "banner", maxCount: 1 },
]);

const verificationUpload = upload.fields([
    { name: "gstDocument",   maxCount: 1 },
    { name: "panDocument",   maxCount: 1 },
    { name: "otherDocument", maxCount: 1 },
]);

// --- PUBLIC ROUTES ---

/**
 * @desc    Get all active shops with filtering and search
 * @route   GET /api/v1/shop/
 * @access  Public
 */
ShopRouter.get("/",               getAllShops);

/**
 * @desc    Get shop details by its unique slug
 * @route   GET /api/v1/shop/slug/:slug
 * @access  Public
 */
ShopRouter.get("/slug/:slug",     getShopBySlug);

/**
 * @desc    Get shop details by its unique vendor code
 * @route   GET /api/v1/shop/code/:shopCode
 * @access  Public
 */
ShopRouter.get("/code/:shopCode", getShopByCode);

/**
 * @desc    Get common shop metadata (Store types, Finance options, Days)
 * @route   GET /api/v1/shop/metadata
 * @access  Public
 */
ShopRouter.get("/metadata",       getShopMetadata);

// --- PROTECTED ROUTES (Requires Login) ---

ShopRouter.use(verifyJWT);

// --- ADMIN MANAGEMENT ---

/**
 * @desc    Get comprehensive shop statistics (Admin dashboard)
 * @route   GET /api/v1/shop/admin/stats
 * @access  Private (Admin)
 */
ShopRouter.get  ("/admin/stats",                           adminGetShopStats);

/**
 * @desc    Get list of all shops for administration
 * @route   GET /api/v1/shop/admin/all
 * @access  Private (Admin)
 */
ShopRouter.get  ("/admin/all",                             adminGetAllShops);

/**
 * @desc    Get pending shop verification requests
 * @route   GET /api/v1/shop/admin/verification-requests
 * @access  Private (Admin)
 */
ShopRouter.get  ("/admin/verification-requests",           adminGetVerificationRequests);

/**
 * @desc    Get full details of a specific verification request
 * @route   GET /api/v1/shop/admin/verification-requests/:shopId
 * @access  Private (Admin)
 */
ShopRouter.get  ("/admin/verification-requests/:shopId",   adminGetVerificationDetail);

/**
 * @desc    Force deactivate a shop (Soft delete)
 * @route   PATCH /api/v1/shop/admin/:shopId/deactivate
 * @access  Private (Admin)
 */
ShopRouter.patch("/admin/:shopId/deactivate",              adminDeactivateShop);

/**
 * @desc    Approve or reject a shop verification request
 * @route   PATCH /api/v1/shop/:shopId/verify
 * @access  Private (Admin)
 */
ShopRouter.patch("/:shopId/verify",                        verifyShop);

// --- VENDOR SELF-MANAGEMENT ---

/**
 * @desc    Get currently logged-in vendor's shop details
 * @route   GET /api/v1/shop/vendor/my
 * @access  Private (Vendor)
 */
ShopRouter.get ("/vendor/my",                              getMyShop);

/**
 * @desc    Get current status of shop verification
 * @route   GET /api/v1/shop/vendor/my/verification-status
 * @access  Private (Vendor)
 */
ShopRouter.get ("/vendor/my/verification-status",          getMyVerificationStatus);

/**
 * @desc    Submit documents for shop verification
 * @route   POST /api/v1/shop/vendor/my/request-verification
 * @access  Private (Vendor)
 */
ShopRouter.post("/vendor/my/request-verification",         verificationUpload, requestVerification);

/**
 * @desc    Register a new shop (Vendor initial setup)
 * @route   POST /api/v1/shop/
 * @access  Private (Vendor)
 */
ShopRouter.post  ("/",                                     shopUpload, createShop);

/**
 * @desc    Update shop profile details
 * @route   PATCH /api/v1/shop/update/:shopId
 * @access  Private (Vendor/Admin)
 */
ShopRouter.patch ("/update/:shopId",                       shopUpload, updateShop);

/**
 * @desc    Permanently delete a shop and its assets
 * @route   DELETE /api/v1/shop/delete/:shopId
 * @access  Private (Vendor/Admin)
 */
ShopRouter.delete("/delete/:shopId",                       deleteShop);

/**
 * @desc    Remove shop logo image
 * @route   DELETE /api/v1/shop/:shopId/logo
 * @access  Private (Vendor/Admin)
 */
ShopRouter.delete("/:shopId/logo",                         deleteShopLogo);

/**
 * @desc    Remove shop banner image
 * @route   DELETE /api/v1/shop/:shopId/banner
 * @access  Private (Vendor/Admin)
 */
ShopRouter.delete("/:shopId/banner",                       deleteShopBanner);

/**
 * @desc    Toggle shop availability status
 * @route   PATCH /api/v1/shop/:shopId/toggle-status
 * @access  Private (Vendor)
 */
ShopRouter.patch ("/:shopId/toggle-status",                toggleShopStatus);

/**
 * @desc    Get shop details by ID
 * @route   GET /api/v1/shop/:shopId
 * @access  Private (Vendor/Admin)
 */
ShopRouter.get("/:shopId",                                 getShopById);

export default ShopRouter;