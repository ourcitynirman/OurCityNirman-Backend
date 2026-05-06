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

// =============================================================================
//                              PUBLIC ROUTES
// =============================================================================

/**
 * @desc    Get paginated list of HSN codes with GST rate and unit info
 * @route   GET /api/v1/hsn
 * @access  Public
 */
router.get('/', getAllHSN);

/**
 * @desc    Get detailed information for a specific HSN code
 * @route   GET /api/v1/hsn/:id
 * @access  Public
 */
router.get('/:id', getHSNById);


// =============================================================================
//                              ADMIN MANAGEMENT
// =============================================================================

// Apply administrative restrictions for write operations
router.use(authenticate, authorize('admin'));

/**
 * @desc    Create a new HSN record for product classification
 * @route   POST /api/v1/hsn
 * @access  Private (Admin)
 */
router.post('/', createHSN);

/**
 * @desc    Bulk import HSN records from a JSON collection
 * @route   POST /api/v1/hsn/bulk
 * @access  Private (Admin)
 */
router.post('/bulk', bulkInsertHSN);

/**
 * @desc    Update an existing HSN record's GST rate or description
 * @route   PUT /api/v1/hsn/:id
 * @access  Private (Admin)
 */
router.put('/:id', updateHSN);

/**
 * @desc    Toggle HSN record status (active/inactive)
 * @route   PATCH /api/v1/hsn/:id/toggle-status
 * @access  Private (Admin)
 */
router.patch('/:id/toggle-status', toggleHSNStatus);

/**
 * @desc    Permanently delete an HSN record from the database
 * @route   DELETE /api/v1/hsn/:id
 * @access  Private (Admin)
 */
router.delete('/:id', deleteHSN);

export default router;
