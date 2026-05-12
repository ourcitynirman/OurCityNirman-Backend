import BrandService from "./brand.service.js";
import { ApiError, ApiResponse } from "../../shared/utils/api.utils.js";
import { brandQuerySchema, brandIdParamSchema, categoryIdParamSchema, createBrandSchema, updateBrandSchema } from "./brand.validation.js";

/**
 * @desc    Get all brands
 */
export const getAllBrands = async (req, res) => {
    try {
        const queryData = brandQuerySchema.parse(req.query);
        const result = await BrandService.getAllBrands(queryData);
        return res.status(200).json(new ApiResponse(200, result, "Brands fetched successfully"));
    } catch (err) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Internal Server Error",
            errors: err.errors || []
        });
    }
};

/**
 * @desc    Get brands by category
 */
export const getBrandsByCategory = async (req, res) => {
    try {
        const { categoryId } = categoryIdParamSchema.parse(req.params);
        const brands = await BrandService.getBrandsByCategory(categoryId);
        return res.status(200).json(new ApiResponse(200, brands, "Brands for category fetched successfully"));
    } catch (err) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Internal Server Error",
            errors: err.errors || []
        });
    }
};

/**
 * @desc    Create new brand (Admin)
 */
export const createBrand = async (req, res) => {
    try {
        const body = { ...req.body };
        
        // Parse categories if sent as JSON string (from FormData)
        if (typeof body.categories === 'string') {
            try { body.categories = JSON.parse(body.categories); } catch (e) { body.categories = [body.categories]; }
        } else if (!body.categories) {
            body.categories = [];
        }

        // Merge legacy categoryId if present
        if (body.categoryId && !body.categories.includes(body.categoryId)) {
            body.categories.push(body.categoryId);
        }

        // Validate
        const brandData = createBrandSchema.parse(body);
        if (req.file) brandData.logo = req.file.path;

        const brand = await BrandService.createBrand(brandData);
        return res.status(201).json(new ApiResponse(201, brand, "Brand created successfully"));
    } catch (err) {
        // Log error to see what's happening
        console.error("[CreateBrand Error]:", err);
        
        if (err.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                message: "Validation Error: " + err.errors.map(e => e.message).join(', '),
                errors: err.errors
            });
        }

        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Internal Server Error",
            errors: err.errors || []
        });
    }
};

/**
 * @desc    Update brand (Admin)
 */
export const updateBrand = async (req, res) => {
    try {
        const { id } = brandIdParamSchema.parse(req.params);
        const body = { ...req.body };

        // Parse categories if sent as JSON string (from FormData)
        if (body.categories !== undefined) {
            if (typeof body.categories === 'string') {
                try { body.categories = JSON.parse(body.categories); } catch (e) { body.categories = [body.categories]; }
            }
            
            // Merge legacy categoryId if present
            if (body.categoryId && !body.categories.includes(body.categoryId)) {
                body.categories.push(body.categoryId);
            }
        }

        const updates = updateBrandSchema.parse(body);
        if (req.file) updates.logo = req.file.path;

        const brand = await BrandService.updateBrand(id, updates);
        return res.status(200).json(new ApiResponse(200, brand, "Brand updated successfully"));
    } catch (err) {
        console.error("[UpdateBrand Error]:", err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Internal Server Error",
            errors: err.errors || []
        });
    }
};

/**
 * @desc    Delete brand (Admin)
 */
export const deleteBrand = async (req, res) => {
    try {
        const { id } = brandIdParamSchema.parse(req.params);
        await BrandService.deleteBrand(id);
        return res.status(200).json(new ApiResponse(200, null, "Brand deleted successfully"));
    } catch (err) {
        console.error("[DeleteBrand Error]:", err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Internal Server Error",
            errors: err.errors || []
        });
    }
};
