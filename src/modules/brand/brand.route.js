import express from 'express';
import {
  getAllBrands,
  getBrandsByCategory,
  createBrand,
  updateBrand,
  deleteBrand
} from './brand.controller.js';
import { verifyJWT, authorize } from '../../shared/middlewares/auth.middleware.js';
import { upload } from '../../shared/middlewares/multer.middleware.js';

const BrandRouter = express.Router();



/**
 * PUBLIC ROUTES
 */
BrandRouter.get('/', getAllBrands);
BrandRouter.get('/by-category/:categoryId', getBrandsByCategory);

/**
 * ADMIN ROUTES (Protected)
 */
BrandRouter.post('/', verifyJWT, authorize('admin', 'vendor'), upload.single('logo'), createBrand);

BrandRouter.patch('/:id', verifyJWT, authorize('admin'), upload.single('logo'), updateBrand);
BrandRouter.delete('/:id', verifyJWT, authorize('admin'), deleteBrand);

export default BrandRouter;
