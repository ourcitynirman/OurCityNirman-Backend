import { Router } from 'express';
import { updateStock, getInventoryByProduct } from './inventory.controller.js';
import { verifyJWT, authorize } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// All inventory routes are protected
router.use(verifyJWT);

/**
 * @desc    Get inventory status for a specific product
 * @route   GET /api/v1/inventory/:productId
 * @access  Private (Owner/Admin)
 */
router.get('/:productId', getInventoryByProduct);

/**
 * @desc    Update stock levels for a specific product
 * @route   PATCH /api/v1/inventory/:productId
 * @access  Private (Owner/Admin/Vendor)
 */
router.patch('/:productId', authorize('vendor', 'admin'), updateStock);

export default router;
