import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from '../../shared/utils/api.utils.js';
import InventoryService from "./inventory.service.js";
import { updateStockSchema, productIdParamSchema } from "./inventory.validation.js";

/**
 * @desc    Update stock quantity for a product
 * @route   PATCH /api/v1/inventory/:productId
 * @access  Private/Owner/Admin
 */
export const updateStock = asyncHandler(async (req, res, next) => {
    try {
        const { productId } = productIdParamSchema.parse(req.params);
        const validatedData = updateStockSchema.parse(req.body);
        const result = await InventoryService.updateStock(productId, validatedData, req.user);

        return res.status(200).json(new ApiResponse(200, result, "Stock updated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get inventory details for a product
 * @route   GET /api/v1/inventory/:productId
 * @access  Private/Owner/Admin
 */
export const getInventoryByProduct = asyncHandler(async (req, res, next) => {
    try {
        const { productId } = productIdParamSchema.parse(req.params);
        const result = await InventoryService.getInventoryByProduct(productId);
        return res.status(200).json(new ApiResponse(200, result, "Inventory fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});
