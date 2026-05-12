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
 * @desc Get all categories (flat list)
 */
export const getAllCategories = asyncHandler(async (req, res) => {
    const { includeInactive } = includeInactiveQuerySchema.parse(req.query);
    const list = await CategoryService.getAllCategories(includeInactive);
    res.status(200).json(new ApiResponse(200, list, "Categories fetched"));
});

/**
 * @desc Get all root categories (top level)
 */
export const getRootCategories = asyncHandler(async (req, res) => {
    const { includeInactive } = includeInactiveQuerySchema.parse(req.query);
    const list = await CategoryService.getRootCategories(includeInactive);
    res.status(200).json(new ApiResponse(200, list, "Roots fetched"));
});

/**
 * @desc Get direct sub-categories of a parent
 */
export const getChildrenCategories = asyncHandler(async (req, res) => {
    const { parentId } = parentIdParamSchema.parse(req.params);
    const { includeInactive } = includeInactiveQuerySchema.parse(req.query);
    
    const list = await CategoryService.getChildrenCategories(parentId, includeInactive);
    res.status(200).json(new ApiResponse(200, list, "Children fetched"));
});

/**
 * @desc Get full category tree (nested)
 */
export const getCategoryTree = asyncHandler(async (req, res) => {
    const { rootId, includeInactive } = getCategoryTreeQuerySchema.parse(req.query);
    const tree = await CategoryService.getCategoryTree(rootId, includeInactive);
    res.status(200).json(new ApiResponse(200, tree, "Tree fetched"));
});

/**
 * @desc Get path (breadcrumb) for a category
 */
export const getCategoryBreadcrumb = asyncHandler(async (req, res) => {
    const { id } = categoryIdParamSchema.parse(req.params);
    const path = await CategoryService.getCategoryBreadcrumb(id);
    res.status(200).json(new ApiResponse(200, path, "Breadcrumb fetched"));
});

/**
 * @desc Create new category
 */
export const createCategory = asyncHandler(async (req, res) => {
    const validatedData = createCategorySchema.parse(req.body);
    const category = await CategoryService.createCategory(validatedData, req.file);
    res.status(201).json(new ApiResponse(201, category, "Created successfully"));
});

/**
 * @desc Update existing category
 */
export const updateCategory = asyncHandler(async (req, res) => {
    const { id } = categoryIdParamSchema.parse(req.params);
    const validatedData = updateCategorySchema.parse(req.body);
    
    const category = await CategoryService.updateCategory(id, validatedData, req.file);
    res.status(200).json(new ApiResponse(200, category, "Updated successfully"));
});

/**
 * @desc Toggle Category activation status
 */
export const toggleCategoryStatus = asyncHandler(async (req, res) => {
    const { id } = categoryIdParamSchema.parse(req.params);
    const category = await CategoryService.toggleCategoryStatus(id);
    res.status(200).json(new ApiResponse(200, category, `Category ${category.isActive ? 'activated' : 'deactivated'}`));
});

/**
 * @desc Permanent Delete category
 */
export const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = categoryIdParamSchema.parse(req.params);
    await CategoryService.deleteCategory(id);
    res.status(200).json(new ApiResponse(200, {}, "Category permanently deleted"));
});

/**
 * @desc Get analytics for a category
 */
export const getCategoryStats = asyncHandler(async (req, res) => {
    const { id } = categoryIdParamSchema.parse(req.params);
    const stats = await CategoryService.getCategoryStats(id);
    res.status(200).json(new ApiResponse(200, stats, "Stats fetched"));
});
