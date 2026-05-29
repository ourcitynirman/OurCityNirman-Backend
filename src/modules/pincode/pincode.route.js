import { Router } from 'express';
import { getPincodeDetails } from './pincode.controller.js';

const router = Router();

// =============================================================================
//                             1. PUBLIC ROUTES
// =============================================================================

/**
 * @route   GET /api/v1/pincode/:pincode
 * @access  Public
 * @desc    Proxies request to postalpincode API to fetch post office details for a given pincode.
 *          Bypasses SSL/CORS issues and provides a fallback if the primary API fails.
 */
router.get('/:pincode', getPincodeDetails);

export default router;
