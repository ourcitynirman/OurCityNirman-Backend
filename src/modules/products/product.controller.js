import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from '../../shared/utils/api.utils.js';
import ProductService from "./product.service.js";
import { 
    productQuerySchema, 
    productIdParamSchema, 
    productSlugParamSchema, 
    productIdentifierParamSchema, 
    vendorIdParamSchema, 
    createProductSchema, 
    updateProductSchema, 
    bulkUpdateProductsSchema, 
    updateBasePriceSchema, 
    addReviewSchema, 
    updateRatingSchema 
} from "./product.validation.js";

/**
 * @desc    Get all products with advanced filtering and pagination
 * @route   GET /api/v1/products
 * @access  Public
 */
/**
 * @desc    Get all products with advanced filtering and pagination
 * @route   GET /api/v1/products
 * @access  Public
 */
export const getAllProducts = asyncHandler(async (req, res) => {
    const queryData = productQuerySchema.parse(req.query);
    const result = await ProductService.getAllProducts(queryData, req.user);

    return res.status(200).json(new ApiResponse(200, result, "Products fetched successfully"));
});

/**
 * @desc    Get product by ID
 * @route   GET /api/v1/products/:id
 * @access  Public
 */
export const getProductById = asyncHandler(async (req, res) => {
    const { id } = productIdParamSchema.parse(req.params);
    const product = await ProductService.getProductById(id, req.user);

    return res.status(200).json(new ApiResponse(200, product, "Product fetched successfully"));
});

/**
 * @desc    Get product by Slug
 * @route   GET /api/v1/products/slug/:slug
 * @access  Public
 */
export const getProductBySlug = asyncHandler(async (req, res) => {
    const { slug } = productSlugParamSchema.parse(req.params);
    const product = await ProductService.getProductBySlug(slug, req.user);

    return res.status(200).json(new ApiResponse(200, product, "Product fetched successfully"));
});

/**
 * @desc    Get product by ID or Slug
 * @route   GET /api/v1/products/identifier/:identifier
 * @access  Public
 */
export const getProductByIdentifier = asyncHandler(async (req, res) => {
    const { identifier } = productIdentifierParamSchema.parse(req.params);
    const product = await ProductService.getProductByIdentifier(identifier, req.user);

    return res.status(200).json(new ApiResponse(200, product, "Product fetched successfully"));
});

/**
 * @desc    Get products by Vendor
 * @route   GET /api/v1/products/vendor/:vendorId
 * @access  Public
 */
export const getProductsByVendor = asyncHandler(async (req, res) => {
    const { vendorId } = vendorIdParamSchema.parse(req.params);
    const result = await ProductService.getProductsByVendor(vendorId, req.query, req.user);

    return res.status(200).json(new ApiResponse(200, result, "Vendor products fetched successfully"));
});

/**
 * @desc    Get featured products
 * @route   GET /api/v1/products/featured
 * @access  Public
 */
export const getFeaturedProducts = asyncHandler(async (req, res) => {
    const products = await ProductService.getFeaturedProducts(req.query);
    return res.status(200).json(new ApiResponse(200, products, "Featured products fetched successfully"));
});

/**
 * @desc    Get trending products
 * @route   GET /api/v1/products/trending
 * @access  Public
 */
export const getTrendingProducts = asyncHandler(async (req, res) => {
    const products = await ProductService.getTrendingProducts(req.query);
    return res.status(200).json(new ApiResponse(200, products, "Trending products fetched successfully"));
});

/**
 * @desc    Get latest products
 * @route   GET /api/v1/products/latest
 * @access  Public
 */
export const getLatestProducts = asyncHandler(async (req, res) => {
    const products = await ProductService.getLatestProducts(req.query);
    return res.status(200).json(new ApiResponse(200, products, "Latest products fetched successfully"));
});

/**
 * @desc    Get products with offers/discounts
 * @route   GET /api/v1/products/offers
 * @access  Public
 */
export const getOfferProducts = asyncHandler(async (req, res) => {
    const result = await ProductService.getOfferProducts(req.query);
    return res.status(200).json(new ApiResponse(200, result, "Offer products fetched successfully"));
});

/**
 * @desc    Create new product
 * @route   POST /api/v1/products
 * @access  Private (Vendor/Admin)
 */
export const createProduct = asyncHandler(async (req, res) => {
    const validatedData = createProductSchema.parse(req.body);
    const product = await ProductService.createProduct(validatedData, req.user, req.files);

    return res.status(201).json(new ApiResponse(201, product, "Product created successfully"));
});

/**
 * @desc    Update existing product
 * @route   PATCH /api/v1/products/:id
 * @access  Private (Vendor/Admin)
 */
export const updateProduct = asyncHandler(async (req, res) => {
    const { id } = productIdParamSchema.parse(req.params);
    const validatedData = updateProductSchema.parse(req.body);
    const product = await ProductService.updateProduct(id, validatedData, req.user, req.files);

    return res.status(200).json(new ApiResponse(200, product, "Product updated successfully"));
});

/**
 * @desc    Soft delete (deactivate) product
 * @route   DELETE /api/v1/products/:id
 * @access  Private (Vendor/Admin)
 */
export const deleteProduct = asyncHandler(async (req, res) => {
    const { id } = productIdParamSchema.parse(req.params);
    await ProductService.deleteProduct(id, req.user);

    return res.status(200).json(new ApiResponse(200, null, "Product deactivated successfully"));
});

/**
 * @desc    Permanently delete product (Admin only)
 * @route   DELETE /api/v1/products/:id/permanent
 * @access  Private (Admin)
 */
export const permanentDeleteProduct = asyncHandler(async (req, res) => {
    const { id } = productIdParamSchema.parse(req.params);
    await ProductService.permanentDeleteProduct(id, req.user);

    return res.status(200).json(new ApiResponse(200, null, "Product permanently deleted"));
});

/**
 * @desc    Bulk update products (Admin only)
 * @route   PATCH /api/v1/products/bulk-update
 * @access  Private (Admin)
 */
export const bulkUpdateProducts = asyncHandler(async (req, res) => {
    const { productIds, updates } = bulkUpdateProductsSchema.parse(req.body);
    const count = await ProductService.bulkUpdateProducts(productIds, updates, req.user);

    return res.status(200).json(new ApiResponse(200, { count }, `${count} products updated successfully`));
});

/**
 * @desc    Toggle product activation status
 * @route   PATCH /api/v1/products/:id/toggle-status
 * @access  Private (Vendor/Admin)
 */
export const toggleProductStatus = asyncHandler(async (req, res) => {
    const { id } = productIdParamSchema.parse(req.params);
    const isActive = await ProductService.toggleProductStatus(id, req.user);

    return res.status(200).json(new ApiResponse(200, { isActive }, `Product ${isActive ? 'activated' : 'deactivated'} successfully`));
});

/**
 * @desc    Toggle featured flag (Admin only)
 * @route   PATCH /api/v1/products/:id/toggle-featured
 * @access  Private (Admin)
 */
export const toggleFeatured = asyncHandler(async (req, res) => {
    const { id } = productIdParamSchema.parse(req.params);
    const featured = await ProductService.toggleFeatured(id, req.user);

    return res.status(200).json(new ApiResponse(200, { featured }, `Product featured status: ${featured}`));
});

/**
 * @desc    Toggle trending flag (Admin only)
 * @route   PATCH /api/v1/products/:id/toggle-trending
 * @access  Private (Admin)
 */
export const toggleTrending = asyncHandler(async (req, res) => {
    const { id } = productIdParamSchema.parse(req.params);
    const trending = await ProductService.toggleTrending(id, req.user);

    return res.status(200).json(new ApiResponse(200, { trending }, `Product trending status: ${trending}`));
});

/**
 * @desc    Update product base price
 * @route   PATCH /api/v1/products/:id/base-price
 * @access  Private (Vendor/Admin)
 */
export const updateBasePrice = asyncHandler(async (req, res) => {
    const { id } = productIdParamSchema.parse(req.params);
    const { basePrice } = updateBasePriceSchema.parse(req.body);
    const updatedPrice = await ProductService.updateBasePrice(id, basePrice, req.user);

    return res.status(200).json(new ApiResponse(200, { basePrice: updatedPrice }, "Base price updated successfully"));
});

/**
 * @desc    Get detailed statistics for products
 * @route   GET /api/v1/products/stats
 * @access  Private (Vendor/Admin)
 */
export const getProductStats = asyncHandler(async (req, res) => {
    const stats = await ProductService.getProductStats(req.user);
    return res.status(200).json(new ApiResponse(200, stats, "Product statistics fetched successfully"));
});

/**
 * @desc    Get products with low stock
 * @route   GET /api/v1/products/low-stock
 * @access  Private (Vendor/Admin)
 */
export const getLowStockProducts = asyncHandler(async (req, res) => {
    const threshold = Number(req.query.threshold) || 50;
    const products = await ProductService.getLowStockProducts(threshold, req.user);
    return res.status(200).json(new ApiResponse(200, products, "Low stock products fetched successfully"));
});

/**
 * @desc    Get all unique brands across products
 * @route   GET /api/v1/products/brands
 * @access  Public
 */
export const getAllBrands = asyncHandler(async (req, res) => {
    const brands = await ProductService.getAllBrands(req.query.category);
    return res.status(200).json(new ApiResponse(200, brands, "All brands fetched successfully"));
});

/**
 * @desc    Link a review to a product
 * @route   POST /api/v1/products/:id/reviews
 * @access  Private
 */
export const addProductReview = asyncHandler(async (req, res) => {
    const { id } = productIdParamSchema.parse(req.params);
    const { reviewId } = addReviewSchema.parse(req.body);
    await ProductService.addProductReview(id, reviewId);

    return res.status(200).json(new ApiResponse(200, null, "Review added successfully"));
});

/**
 * @desc    Update product average rating
 * @route   PATCH /api/v1/products/:id/rating
 * @access  Private
 */
export const updateProductRating = asyncHandler(async (req, res) => {
    const { id } = productIdParamSchema.parse(req.params);
    const { rating } = updateRatingSchema.parse(req.body);
    const newRating = await ProductService.updateProductRating(id, rating);

    return res.status(200).json(new ApiResponse(200, { rating: newRating }, "Product rating updated successfully"));
});

/**
 * @desc    Get min/max price range for products based on category/brand
 * @route   GET /api/v1/products/price-range
 * @access  Public
 */
export const getProductPriceRange = asyncHandler(async (req, res) => {
    const range = await ProductService.getPriceRange(req.query);
    return res.status(200).json(new ApiResponse(200, range, "Price range fetched successfully"));
});

// --- SEARCH CONTROLLER RE-EXPORT ---
export { SearchProducts } from '../search/search.controller.js';