
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getSearchSuggestions,
  getRecentlyViewed,
  logRecentlyViewed,
  compareProducts,
} from '../../controllers/product/search.controller.js';

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


SearchRoute.get(
  '/search/suggestions',
  suggestionsLimiter,
  getSearchSuggestions
);


SearchRoute.post(
  '/recently-viewed/fetch',
  recentlyViewedLimiter,
  getRecentlyViewed
);


SearchRoute.post(
  '/recently-viewed',
  recentlyViewedLimiter,
  logRecentlyViewed
);


SearchRoute.post(
  '/compare',
  compareLimiter,
  compareProducts
);

export default SearchRoute;


