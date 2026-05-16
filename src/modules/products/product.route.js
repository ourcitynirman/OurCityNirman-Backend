import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getAllProducts,
  getProductById,
  getProductBySlug,
  getProductsByVendor,
  createProduct,
  updateProduct,
  deleteProduct,
  permanentDeleteProduct,
  updateBasePrice,
  getProductStats,
  getFeaturedProducts,
  getTrendingProducts,
  getLowStockProducts,
  getAllBrands,
  bulkUpdateProducts,
  SearchProducts,
  getLatestProducts,
  getProductByIdentifier,
  getOfferProducts,
  addProductReview,
  updateProductRating,
  toggleProductStatus,
  toggleFeatured,
  toggleTrending,
  getProductPriceRange,
} from "./product.controller.js";
import { updateStock as updateProductStock } from "../inventory/inventory.controller.js";
import {
  getSearchSuggestions,
  getRecentlyViewed,
  logRecentlyViewed,
  compareProducts,
} from '../search/search.controller.js';
import { authorize, verifyJWT, optionalJWT } from "../../shared/middlewares/auth.middleware.js";
import { upload } from '../../shared/middlewares/multer.middleware.js';

const r = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message },
  validate: { xForwardedForHeader: false }
});

const publicLimiter = r(15 * 60 * 1000, 100, 'Too many requests');
const searchLimiter = r(60 * 1000, 60, 'Too many search requests');
const suggestionsLimiter = r(60 * 1000, 120, 'Too many suggestion requests');
const compareLimiter = r(60 * 1000, 20, 'Too many compare requests');
const writeLimiter = r(60 * 1000, 30, 'Too many write requests');

const imageUpload = upload.fields([{ name: 'images', maxCount: 5 }]);

const ProductsRoute = express.Router();

// --- PUBLIC ROUTES ---
/**
 * @desc    Get all products with advanced filtering and pagination
 * @route   GET /api/v1/products
 * @access  Public
 */
ProductsRoute.get('/', optionalJWT, publicLimiter, getAllProducts);
ProductsRoute.get('/public/list', optionalJWT, publicLimiter, getAllProducts);

/**
 * @desc    Full-text search for products with filters and sorting
 * @route   GET /api/v1/products/search
 * @access  Public
 */
ProductsRoute.get('/search', searchLimiter, SearchProducts);

/**
 * @desc    Get live search suggestions (brands, categories, products)
 * @route   GET /api/v1/products/search/suggestions
 * @access  Public
 */
ProductsRoute.get('/search/suggestions', suggestionsLimiter, getSearchSuggestions);

// --- VENDOR (auth + isVendor) ---
/**
 * @desc    Get products listed by the logged-in vendor
 * @route   GET /api/v1/products/vendor/my-products
 * @access  Private/Vendor
 */
ProductsRoute.get('/vendor/my-products', verifyJWT, authorize('vendor', 'admin'), getProductsByVendor);

/**
 * @desc    Get products listed by a specific vendor ID
 * @route   GET /api/v1/products/vendor/:vendorId
 * @access  Private/Vendor/Admin
 */
ProductsRoute.get('/vendor/:vendorId', verifyJWT, authorize('vendor', 'admin'), getProductsByVendor);

/**
 * @desc    Get overview stats for vendor products
 * @route   GET /api/v1/products/stats/overview
 * @access  Private/Vendor/Admin
 */
ProductsRoute.get('/stats/overview', verifyJWT, authorize('vendor', 'admin'), getProductStats);

/**
 * @desc    Get products with low stock for vendor
 * @route   GET /api/v1/products/low-stock
 * @access  Private/Vendor/Admin
 */
ProductsRoute.get('/low-stock', verifyJWT, authorize('vendor', 'admin'), getLowStockProducts);

// --- PUBLIC FETCH ROUTES ---
/**
 * @desc    Get featured products
 * @route   GET   
 * @access  Public
 */
ProductsRoute.get('/featured', publicLimiter, getFeaturedProducts);

/**
 * @desc    Get trending products based on popularity
 * @route   /api/v1/products/trending
 * @access  Public
 */
ProductsRoute.get('/trending', publicLimiter, getTrendingProducts);

/**
 * @desc    Get latest added products
 * @route   GET /api/v1/products/latest
 * @access  Public
 */
ProductsRoute.get('/latest', publicLimiter, getLatestProducts);

/**
 * @desc    Get products with active offers/discounts
 * @route   GET /api/v1/products/offers
 * @access  Public
 */
ProductsRoute.get('/offers', publicLimiter, getOfferProducts);

/**
 * @desc    Get all available brands from products (Legacy/Faceted fallback)
 * @route   GET /api/v1/products/filters/brands
 * @access  Public
 */
ProductsRoute.get('/filters/brands', publicLimiter, getAllBrands);

/**
 * @desc    Get min/max price range for products based on filters
 * @route   GET /api/v1/products/price-range
 * @access  Public
 */
ProductsRoute.get('/price-range', publicLimiter, getProductPriceRange);

/**
 * @desc    Get single product by MongoDB ID
 * @route   GET /api/v1/products/id/:id
 * @access  Public
 */
ProductsRoute.get('/id/:id', publicLimiter, getProductById);
ProductsRoute.get('/public/details/:id', publicLimiter, getProductById);

/**
 * @desc    Get single product by SEO slug
 * @route   GET /api/v1/products/slug/:slug
 * @access  Public
 */
ProductsRoute.get('/slug/:slug', publicLimiter, getProductBySlug);

/**
 * @desc    Get product by either ID or Slug (identifier)
 * @route   GET /api/v1/products/:identifier
 * @access  Public
 */
ProductsRoute.get('/:identifier', publicLimiter, getProductByIdentifier);

/**
 * @desc    Compare multiple products (2-4 items)
 * @route   POST /api/v1/products/compare
 * @access  Public
 */
ProductsRoute.post('/compare', compareLimiter, compareProducts);

/**
 * @desc    Log a product as recently viewed by user
 * @route   POST /api/v1/products/recently-viewed
 * @access  Public
 */
ProductsRoute.post('/recently-viewed', logRecentlyViewed);

/**
 * @desc    Fetch product details for recently viewed history
 * @route   POST /api/v1/products/recently-viewed/fetch
 * @access  Public
 */
ProductsRoute.post('/recently-viewed/fetch', getRecentlyViewed);

/**
 * @desc    Create a new product listing
 * @route   POST /api/v1/products
 * @access  Private/Vendor/Admin
 */
ProductsRoute.post('/', verifyJWT, authorize('vendor', 'admin'), writeLimiter, imageUpload, createProduct);

/**
 * @desc    Update an existing product listing
 * @route   PATCH /api/v1/products/:id
 * @access  Private/Vendor/Admin
 */
ProductsRoute.patch('/:id', verifyJWT, authorize('vendor', 'admin'), writeLimiter, imageUpload, updateProduct);

/**
 * @desc    Soft delete a product (mark inactive)
 * @route   DELETE /api/v1/products/:id
 * @access  Private/Vendor/Admin
 */
ProductsRoute.delete('/:id', verifyJWT, authorize('vendor', 'admin'), deleteProduct);

/**
 * @desc    Update product stock levels
 * @route   PATCH /api/v1/products/:id/stock
 * @access  Private/Vendor/Admin
 */
ProductsRoute.patch('/:id/stock', verifyJWT, authorize('vendor', 'admin'), writeLimiter, updateProductStock);

/**
 * @desc    Toggle product featured status
 * @route   PATCH /api/v1/products/:id/featured
 * @access  Private/Admin
 */
ProductsRoute.patch('/:id/featured', verifyJWT, authorize('vendor', 'admin'), toggleFeatured);

/**
 * @desc    Toggle product trending status
 * @route   PATCH /api/v1/products/:id/trending
 * @access  Private/Admin
 */
ProductsRoute.patch('/:id/trending', verifyJWT, authorize('vendor', 'admin'), toggleTrending);

/**
 * @desc    Update product base price (Admin/Owner only)
 * @route   PATCH /api/v1/products/:id/base-price
 * @access  Private/Vendor/Admin
 */
ProductsRoute.patch('/:id/base-price', verifyJWT, authorize('vendor', 'admin'), updateBasePrice);

/**
 * @desc    Toggle product active/inactive status
 * @route   PATCH /api/v1/products/:id/toggle-status
 * @access  Private/Vendor/Admin
 */
ProductsRoute.patch('/:id/toggle-status', verifyJWT, authorize('vendor', 'admin'), toggleProductStatus);

// --- ADMIN (auth + isAdmin) ---
/**
 * @desc    Bulk update multiple products
 * @route   POST /api/v1/products/bulk
 * @access  Private/Admin
 */
ProductsRoute.post('/bulk', verifyJWT, authorize('admin'), writeLimiter, bulkUpdateProducts);

/**
 * @desc    Permanently delete a product and its assets
 * @route   DELETE /api/v1/products/:id/permanent
 * @access  Private/Admin
 */
ProductsRoute.delete('/:id/permanent', verifyJWT, authorize('admin'), permanentDeleteProduct);

/**
 * @desc    Add or update an internal review for a product
 * @route   PATCH /api/v1/products/:id/review
 * @access  Private/Admin
 */
ProductsRoute.patch('/:id/review', verifyJWT, authorize('admin'), addProductReview);

/**
 * @desc    Force update product rating/review stats
 * @route   PATCH /api/v1/products/:id/rating
 * @access  Private/Admin
 */
ProductsRoute.patch('/:id/rating', verifyJWT, authorize('admin'), updateProductRating);

export default ProductsRoute;