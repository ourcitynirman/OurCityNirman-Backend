import BrandService from "./brand.service.js";
import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import { brandQuerySchema, brandIdParamSchema, categoryIdParamSchema, createBrandSchema, updateBrandSchema } from "./brand.validation.js";

/**
 * @desc    Get all brands (with pagination and search)
 * @route   GET /api/v1/brands
 * @access  Public
 */
export const getAllBrands = asyncHandler(async (req, res, next) => {
    try {
        const queryData = brandQuerySchema.parse(req.query);
        const result = await BrandService.getAllBrands(queryData);

        return res.status(200).json(
            new ApiResponse(200, result, "Brands fetched successfully")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get brands by category (Amazon Style)
 * @route   GET /api/v1/brands/by-category/:categoryId
 * @access  Public
 */
export const getBrandsByCategory = asyncHandler(async (req, res, next) => {
    try {
        const { categoryId } = categoryIdParamSchema.parse(req.params);
        const brands = await BrandService.getBrandsByCategory(categoryId);

        return res.status(200).json(
            new ApiResponse(200, brands, "Brands for category fetched successfully")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Create new brand (Admin)
 * @route   POST /api/v1/brands
 * @access  Private/Admin
 */
export const createBrand = asyncHandler(async (req, res, next) => {
    try {
        const brandData = createBrandSchema.parse(req.body);
        const brand = await BrandService.createBrand(brandData);

        return res.status(201).json(
            new ApiResponse(201, brand, "Brand created successfully")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Update brand (Admin)
 * @route   PATCH /api/v1/brands/:id
 * @access  Private/Admin
 */
export const updateBrand = asyncHandler(async (req, res, next) => {
    try {
        const { id } = brandIdParamSchema.parse(req.params);
        const updates = updateBrandSchema.parse(req.body);
        
        const brand = await BrandService.updateBrand(id, updates);

        return res.status(200).json(
            new ApiResponse(200, brand, "Brand updated successfully")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Delete brand (Admin)
 * @route   DELETE /api/v1/brands/:id
 * @access  Private/Admin
 */
export const deleteBrand = asyncHandler(async (req, res, next) => {
    try {
        const { id } = brandIdParamSchema.parse(req.params);
        await BrandService.deleteBrand(id);

        return res.status(200).json(
            new ApiResponse(200, null, "Brand deleted successfully")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});
