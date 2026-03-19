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
  updateProductStock,
  updateBasePrice,
  getProductStats,
  getFeaturedProducts,
  getTrendingProducts,
  getLowStockProducts,
  getAllBrands,
  getAllCategories,
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
} from "../../controllers/product/product.controller.js";

import {
  getSearchSuggestions,
  getRecentlyViewed,
  logRecentlyViewed,
  compareProducts,
} from '../../controllers/product/search.controller.js';

import { authorize, verifyJWT, optionalJWT } from "../../middlewares/auth.middleware.js";
import { upload } from '../../middlewares/multer.middleware.js';

const r = (windowMs, max, message) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { success: false, message } });

const publicLimiter = r(15 * 60 * 1000, 100, 'Too many requests');
const searchLimiter = r(60 * 1000, 20, 'Too many search requests');
const suggestionsLimiter = r(60 * 1000, 60, 'Too many suggestion requests');
const compareLimiter = r(60 * 1000, 10, 'Too many compare requests');
const recentlyViewedLimiter = r(60 * 1000, 30, 'Too many requests');
const writeLimiter = r(60 * 1000, 30, 'Too many write requests');

const imageUpload = upload.fields([{ name: 'images', maxCount: 5 }]);

const ProductsRoute = express.Router();

ProductsRoute.get('/products', optionalJWT, publicLimiter, getAllProducts);
ProductsRoute.get('/products/featured', publicLimiter, getFeaturedProducts);
ProductsRoute.get('/products/trending', publicLimiter, getTrendingProducts);
ProductsRoute.get('/products/latest', publicLimiter, getLatestProducts);
ProductsRoute.get('/products/offers', publicLimiter, getOfferProducts);
ProductsRoute.get('/filters/brands', publicLimiter, getAllBrands);
ProductsRoute.get('/filters/categories', getAllCategories);

ProductsRoute.get('/search', searchLimiter, SearchProducts);
ProductsRoute.get('/search/suggestions', suggestionsLimiter, getSearchSuggestions);

ProductsRoute.post('/recently-viewed', recentlyViewedLimiter, logRecentlyViewed);
ProductsRoute.post('/recently-viewed/fetch', recentlyViewedLimiter, getRecentlyViewed);
ProductsRoute.post('/compare', compareLimiter, compareProducts);

ProductsRoute.get('/product/slug/:slug', publicLimiter, getProductBySlug);
ProductsRoute.get('/product/id/:id', publicLimiter, getProductById);
ProductsRoute.get('/product/:identifier', publicLimiter, getProductByIdentifier);

ProductsRoute.get(
  '/products/low-stock',
  verifyJWT, authorize('vendor', 'admin'),
  getLowStockProducts
);

ProductsRoute.get(
  '/vendor/my-products',
  verifyJWT, authorize('vendor', 'admin'),
  getProductsByVendor
);

ProductsRoute.get(
  '/vendor/:vendorId/products',
  verifyJWT, authorize('admin'),
  getProductsByVendor
);

ProductsRoute.get(
  '/stats/overview',
  verifyJWT, authorize('vendor', 'admin'),
  getProductStats
);

ProductsRoute.post(
  '/product/create',
  verifyJWT, authorize('vendor', 'admin'),
  writeLimiter, imageUpload,
  createProduct
);

ProductsRoute.put(
  '/product/:id',
  verifyJWT, authorize('vendor', 'admin'),
  imageUpload,
  updateProduct
);

ProductsRoute.patch(
  '/product/:id/stock',
  verifyJWT, authorize('vendor', 'admin'),
  updateProductStock
);

ProductsRoute.patch(
  '/product/:id/base-price',
  verifyJWT, authorize('vendor', 'admin'),
  updateBasePrice
);

ProductsRoute.patch(
  '/product/:id/base-price',
  verifyJWT, authorize('vendor', 'admin'),
  updateBasePrice
);

ProductsRoute.patch(
  '/product/:id/rating',
  verifyJWT, authorize('admin'),
  updateProductRating
);

ProductsRoute.patch(
  '/product/:id/review',
  verifyJWT, authorize('admin'),
  addProductReview
);

ProductsRoute.patch(
  '/product/:id/toggle-status',
  verifyJWT, authorize('vendor', 'admin'),
  toggleProductStatus
);

ProductsRoute.patch(
  '/product/:id/featured',
  verifyJWT, authorize('admin'),
  toggleFeatured
);

ProductsRoute.patch(
  '/product/:id/trending',
  verifyJWT, authorize('admin'),
  toggleTrending
);

ProductsRoute.patch(
  '/bulk-update',
  verifyJWT, authorize('vendor', 'admin'),
  bulkUpdateProducts
);

ProductsRoute.delete(
  '/product/:id/permanent',
  verifyJWT, authorize('admin'),
  permanentDeleteProduct
);

ProductsRoute.delete(
  '/product/:id',
  verifyJWT, authorize('vendor', 'admin'),
  deleteProduct
);

export default ProductsRoute;