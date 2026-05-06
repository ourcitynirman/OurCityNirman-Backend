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
    adminShopQuerySchema 
} from "./shop.validation.js";

/**
 * @desc    Register a new shop (Vendor initial setup)
 * @route   POST /api/v1/shop/
 * @access  Private (Vendor)
 */
export const createShop = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = createShopSchema.parse(req.body);
        const shop = await ShopService.createShop(validatedData, req.user, req.files);
        return res.status(201).json(new ApiResponse(201, shop, "Shop created successfully."));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
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
    const storeTypes = Shop.schema.path("storeType").options.enum.values;
    const financeOptions = Shop.schema.path("financeOptions").options.enum.values;
    const days = Shop.schema.path("availability.daysOpen").options.enum.values;
    return res.status(200).json(new ApiResponse(200, { storeTypes, financeOptions, days }, "Shop metadata fetched successfully"));
});

/**
 * @desc    Update shop profile details
 */
export const updateShop = asyncHandler(async (req, res, next) => {
    try {
        const { shopId } = shopIdParamSchema.parse(req.params);
        const validatedData = updateShopSchema.parse(req.body);
        const shop = await ShopService.updateShop(shopId, validatedData, req.user, req.files);
        return res.status(200).json(new ApiResponse(200, shop, "Shop updated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Permanently delete a shop
 */
export const deleteShop = asyncHandler(async (req, res, next) => {
    try {
        const { shopId } = shopIdParamSchema.parse(req.params);
        await ShopService.deleteShop(shopId, req.user);
        return res.status(200).json(new ApiResponse(200, {}, "Shop deleted successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Remove shop logo
 */
export const deleteShopLogo = asyncHandler(async (req, res, next) => {
    try {
        const { shopId } = shopIdParamSchema.parse(req.params);
        const shop = await ShopService.deleteShopLogo(shopId, req.user);
        return res.status(200).json(new ApiResponse(200, shop, "Logo removed"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Remove shop banner
 */
export const deleteShopBanner = asyncHandler(async (req, res, next) => {
    try {
        const { shopId } = shopIdParamSchema.parse(req.params);
        const shop = await ShopService.deleteShopBanner(shopId, req.user);
        return res.status(200).json(new ApiResponse(200, shop, "Banner removed"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Toggle shop availability status
 */
export const toggleShopStatus = asyncHandler(async (req, res, next) => {
    try {
        const { shopId } = shopIdParamSchema.parse(req.params);
        const shop = await ShopService.toggleShopStatus(shopId, req.user);
        return res.status(200).json(new ApiResponse(200, shop, `Shop ${shop.isActive ? 'activated' : 'deactivated'}`));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
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
export const getAllShops = asyncHandler(async (req, res, next) => {
    try {
        const queryData = shopQuerySchema.parse(req.query);
        const result = await ShopService.getAllShops(queryData);
        return res.status(200).json(new ApiResponse(200, result, "Shops fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Get shop by ID
 */
export const getShopById = asyncHandler(async (req, res, next) => {
    try {
        const { shopId } = shopIdParamSchema.parse(req.params);
        const shop = await ShopService.getShopById(shopId);
        return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Get shop by slug
 */
export const getShopBySlug = asyncHandler(async (req, res, next) => {
    try {
        const { slug } = shopSlugParamSchema.parse(req.params);
        const shop = await ShopService.getShopBySlug(slug);
        return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Get shop by code
 */
export const getShopByCode = asyncHandler(async (req, res, next) => {
    try {
        const { shopCode } = shopCodeParamSchema.parse(req.params);
        const shop = await ShopService.getShopByCode(shopCode);
        return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Get pending shop verification requests (Admin)
 */
export const adminGetVerificationRequests = asyncHandler(async (req, res, next) => {
    try {
        const queryData = adminShopQuerySchema.parse(req.query);
        const result = await ShopService.adminGetVerificationRequests(queryData);
        return res.status(200).json(new ApiResponse(200, result, "Requests fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Get verification details for a shop (Admin)
 */
export const adminGetVerificationDetail = asyncHandler(async (req, res, next) => {
    try {
        const { shopId } = shopIdParamSchema.parse(req.params);
        const shop = await ShopService.adminGetVerificationDetail(shopId);
        return res.status(200).json(new ApiResponse(200, shop, "Verification details fetched"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Verify shop (Admin)
 */
export const verifyShop = asyncHandler(async (req, res, next) => {
    try {
        const { shopId } = shopIdParamSchema.parse(req.params);
        const { action, reason } = verifyShopSchema.parse(req.body);
        const shop = await ShopService.verifyShop(shopId, action, reason, req.user);
        return res.status(200).json(new ApiResponse(200, shop, "Shop verification complete"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Get all shops (Admin)
 */
export const adminGetAllShops = asyncHandler(async (req, res, next) => {
    try {
        const queryData = adminShopQuerySchema.parse(req.query);
        const result = await ShopService.adminGetAllShops(queryData);
        return res.status(200).json(new ApiResponse(200, result, "All shops fetched"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Deactivate shop (Admin)
 */
export const adminDeactivateShop = asyncHandler(async (req, res, next) => {
    try {
        const { shopId } = shopIdParamSchema.parse(req.params);
        const shop = await ShopService.adminDeactivateShop(shopId);
        return res.status(200).json(new ApiResponse(200, shop, "Shop deactivated by admin"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
            return next(new ApiError('Validation Error: ' + messages, 400));
        }
        next(err);
    }
});

/**
 * @desc    Get shop statistics (Admin)
 */
export const adminGetShopStats = asyncHandler(async (req, res) => {
    const stats = await ShopService.adminGetShopStats();
    return res.status(200).json(new ApiResponse(200, stats, "Stats fetched successfully"));
});