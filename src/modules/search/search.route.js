import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getSearchSuggestions,
  getRecentlyViewed,
  logRecentlyViewed,
  compareProducts,
  SearchProducts,
} from './search.controller.js';

const SearchRoute = express.Router();

const suggestionsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,      
  max: 60,                       
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many search requests. Please wait a moment.',
  },
  validate: { xForwardedForHeader: false },
  skipSuccessfulRequests: false,
});

const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many search requests. Please wait.',
  },
  validate: { xForwardedForHeader: false },
});

const compareLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many compare requests. Please wait.',
  },
  validate: { xForwardedForHeader: false },
});

const recentlyViewedLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many requests.',
  },
  validate: { xForwardedForHeader: false },
});

/**
 * @desc    Full-text search for products with filters and sorting
 * @route   GET /api/v1/search/
 * @access  Public
 */
SearchRoute.get(
  '/',
  searchLimiter,
  SearchProducts
);

/**
 * @desc    Get live search suggestions (brands, categories, products)
 * @route   GET /api/v1/search/suggestions
 * @access  Public
 */
SearchRoute.get(
  '/suggestions',
  suggestionsLimiter,
  getSearchSuggestions
);

/**
 * @desc    Fetch product details for recently viewed IDs
 * @route   POST /api/v1/search/recently-viewed/fetch
 * @access  Public
 */
SearchRoute.post(
  '/recently-viewed/fetch',
  recentlyViewedLimiter,
  getRecentlyViewed
);

/**
 * @desc    Log a product as recently viewed
 * @route   POST /api/v1/search/recently-viewed
 * @access  Public
 */
SearchRoute.post(
  '/recently-viewed',
  recentlyViewedLimiter,
  logRecentlyViewed
);

/**
 * @desc    Compare multiple products (2-4 products)
 * @route   POST /api/v1/search/compare
 * @access  Public
 */
SearchRoute.post(
  '/compare',
  compareLimiter,
  compareProducts
);

export default SearchRoute;
