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
BrandRouter.post('/', verifyJWT, authorize('admin', 'vendor'), upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'icon', maxCount: 1 }
]), createBrand);

BrandRouter.patch('/:id', verifyJWT, authorize('admin'), upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'icon', maxCount: 1 }
]), updateBrand);
BrandRouter.delete('/:id', verifyJWT, authorize('admin'), deleteBrand);

export default BrandRouter;
