import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from '../../shared/utils/api.utils.js';
import SearchService from "./search.service.js";
import { 
    searchSuggestionsQuerySchema, 
    logRecentlyViewedSchema, 
    getRecentlyViewedSchema, 
    compareProductsSchema, 
    searchProductsQuerySchema 
} from "./search.validation.js";

/**
 * @desc    Get live search suggestions (brands, categories, products)
 * @route   GET /api/v1/products/search/suggestions
 * @access  Public
 */
export const getSearchSuggestions = asyncHandler(async (req, res, next) => {
    try {
        const { q, limit } = searchSuggestionsQuerySchema.parse(req.query);
        const result = await SearchService.getSearchSuggestions(q, limit);
        return res.status(200).json(new ApiResponse(200, result, 'Suggestions fetched successfully'));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Log a product as recently viewed
 * @route   POST /api/v1/products/recently-viewed
 * @access  Public
 */
export const logRecentlyViewed = asyncHandler(async (req, res, next) => {
    try {
        const { productId } = logRecentlyViewedSchema.parse(req.body || {});
        
        // Validate product existence and potentially track metrics
        await SearchService.logRecentlyViewed(productId);

        return res.status(200).json(new ApiResponse(200, { logged: true, productId }, 'View logged'));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    } 
});

/**
 * @desc    Fetch product details for recently viewed IDs
 * @route   POST /api/v1/products/recently-viewed/fetch
 * @access  Public
 */
export const getRecentlyViewed = asyncHandler(async (req, res, next) => {
    try {
        const { productIds } = getRecentlyViewedSchema.parse(req.body);
        const result = await SearchService.getRecentlyViewed(productIds);
        return res.status(200).json(new ApiResponse(200, result, 'Recently viewed products fetched successfully'));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Compare multiple products (2-4 products)
 * @route   POST /api/v1/products/compare
 * @access  Public
 */
export const compareProducts = asyncHandler(async (req, res, next) => {
    try {
        const { productIds } = compareProductsSchema.parse(req.body);
        const result = await SearchService.compareProducts(productIds);
        return res.status(200).json(new ApiResponse(200, result, 'Comparison data fetched successfully'));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Full-text search for products with filters and sorting (FACETED SEARCH)
 * @route   GET /api/v1/products/search
 * @access  Public
 */
export const SearchProducts = asyncHandler(async (req, res, next) => {
    try {
        const queryData = searchProductsQuerySchema.parse(req.query);
        if (!queryData.q && !queryData.search) {
            throw new ApiError(400, 'Search query required');
        }
        const result = await SearchService.SearchProducts(queryData);
        return res.status(200).json(new ApiResponse(200, result, "Search results fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});