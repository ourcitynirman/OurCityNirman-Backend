import express from 'express';
import {
  getAllBrands,
  getBrandsByCategory,
  createBrand,
  updateBrand,
  deleteBrand
} from './brand.controller.js';
import { verifyJWT, authorize } from '../../shared/middlewares/auth.middleware.js';

const BrandRouter = express.Router();

/**
 * PUBLIC ROUTES
 */

/**
 * @desc    Get all brands with pagination and search
 * @route   GET /api/v1/brands
 * @access  Public
 */
BrandRouter.get('/', getAllBrands);

/**
 * @desc    Get brands relevant to a specific category (hierarchical)
 * @route   GET /api/v1/brands/by-category/:categoryId
 * @access  Public
 */
BrandRouter.get('/by-category/:categoryId', getBrandsByCategory);

/**
 * ADMIN ROUTES (Protected)
 */

/**
 * @desc    Create a new brand
 * @route   POST /api/v1/brands
 * @access  Private/Admin
 */
BrandRouter.post('/', verifyJWT, authorize('admin'), createBrand);

/**
 * @desc    Update an existing brand
 * @route   PATCH /api/v1/brands/:id
 * @access  Private/Admin
 */
BrandRouter.patch('/:id', verifyJWT, authorize('admin'), updateBrand);

/**
 * @desc    Delete a brand
 * @route   DELETE /api/v1/brands/:id
 * @access  Private/Admin
 */
BrandRouter.delete('/:id', verifyJWT, authorize('admin'), deleteBrand);

export default BrandRouter;
