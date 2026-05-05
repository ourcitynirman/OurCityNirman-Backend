import { Router } from 'express';
import {
    createHSN,
    getAllHSN,
    getHSNById,
    updateHSN,
    deleteHSN,
    bulkInsertHSN,
    toggleHSNStatus
} from './hsn.controller.js';
import { authenticate, authorize } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// --- PUBLIC ROUTES ---
/**
 * @desc    Get all HSN codes with pagination and search
 * @route   GET /api/v1/hsn
 * @access  Public
 */
router.get('/', getAllHSN);

/**
 * @desc    Get details of a specific HSN code
 * @route   GET /api/v1/hsn/:id
 * @access  Public
 */
router.get('/:id', getHSNById);

// --- PRIVATE ROUTES (Admin Only) ---
router.use(authenticate, authorize('admin'));

/**
 * @desc    Create a new HSN code
 * @route   POST /api/v1/hsn
 * @access  Private (Admin)
 */
router.post('/', createHSN);

/**
 * @desc    Bulk insert multiple HSN codes from a JSON list
 * @route   POST /api/v1/hsn/bulk
 * @access  Private (Admin)
 */
router.post('/bulk', bulkInsertHSN);

/**
 * @desc    Update an existing HSN code details
 * @route   PUT /api/v1/hsn/:id
 * @access  Private (Admin)
 */
router.put('/:id', updateHSN);

/**
 * @desc    Toggle HSN code active/inactive status
 * @route   PATCH /api/v1/hsn/:id/toggle-status
 * @access  Private (Admin)
 */
router.patch('/:id/toggle-status', toggleHSNStatus);

/**
 * @desc    Delete an HSN code from the database
 * @route   DELETE /api/v1/hsn/:id
 * @access  Private (Admin)
 */
router.delete('/:id', deleteHSN);

export default router;
