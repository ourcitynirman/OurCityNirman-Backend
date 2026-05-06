import CategoryService from "./category.service.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import { asyncHandler } from "../../shared/utils/api.utils.js";
import { 
    categoryIdParamSchema, 
    parentIdParamSchema, 
    getCategoryTreeQuerySchema, 
    includeInactiveQuerySchema, 
    createCategorySchema, 
    updateCategorySchema 
} from "./category.validation.js";

/**
 * @desc Get all root categories (top level)
 */
export const getRootCategories = asyncHandler(async (req, res, next) => {
    try {
        const { includeInactive } = includeInactiveQuerySchema.parse(req.query);
        const list = await CategoryService.getRootCategories(includeInactive);
        res.status(200).json(new ApiResponse(200, list, "Roots fetched"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc Get direct sub-categories of a parent
 */
export const getChildrenCategories = asyncHandler(async (req, res, next) => {
    try {
        const { parentId } = parentIdParamSchema.parse(req.params);
        const { includeInactive } = includeInactiveQuerySchema.parse(req.query);
        
        const list = await CategoryService.getChildrenCategories(parentId, includeInactive);
        res.status(200).json(new ApiResponse(200, list, "Children fetched"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc Get full category tree (nested)
 */
export const getCategoryTree = asyncHandler(async (req, res, next) => {
    try {
        const { rootId, includeInactive } = getCategoryTreeQuerySchema.parse(req.query);
        const tree = await CategoryService.getCategoryTree(rootId, includeInactive);
        res.status(200).json(new ApiResponse(200, tree, "Tree fetched"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc Get path (breadcrumb) for a category
 */
export const getCategoryBreadcrumb = asyncHandler(async (req, res, next) => {
    try {
        const { id } = categoryIdParamSchema.parse(req.params);
        const path = await CategoryService.getCategoryBreadcrumb(id);
        res.status(200).json(new ApiResponse(200, path, "Breadcrumb fetched"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc Create new category
 */
export const createCategory = asyncHandler(async (req, res, next) => {
    try {
        const validatedData = createCategorySchema.parse(req.body);
        const category = await CategoryService.createCategory(validatedData, req.file);
        res.status(201).json(new ApiResponse(201, category, "Created successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc Update existing category
 */
export const updateCategory = asyncHandler(async (req, res, next) => {
    try {
        const { id } = categoryIdParamSchema.parse(req.params);
        const validatedData = updateCategorySchema.parse(req.body);
        
        const category = await CategoryService.updateCategory(id, validatedData, req.file);
        res.status(200).json(new ApiResponse(200, category, "Updated successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc Toggle Category activation status
 */
export const toggleCategoryStatus = asyncHandler(async (req, res, next) => {
    try {
        const { id } = categoryIdParamSchema.parse(req.params);
        const category = await CategoryService.toggleCategoryStatus(id);
        res.status(200).json(new ApiResponse(200, category, `Category ${category.isActive ? 'activated' : 'deactivated'}`));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc Permanent Delete category
 */
export const deleteCategory = asyncHandler(async (req, res, next) => {
    try {
        const { id } = categoryIdParamSchema.parse(req.params);
        await CategoryService.deleteCategory(id);
        res.status(200).json(new ApiResponse(200, {}, "Category permanently deleted"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc Get analytics for a category
 */
export const getCategoryStats = asyncHandler(async (req, res, next) => {
    try {
        const { id } = categoryIdParamSchema.parse(req.params);
        const stats = await CategoryService.getCategoryStats(id);
        res.status(200).json(new ApiResponse(200, stats, "Stats fetched"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});
