import { asyncHandler } from '../../shared/utils/api.utils.js';
import { ApiResponse } from '../../shared/utils/api.utils.js';
import VendorService from './vendor.service.js';

/**
 * @desc    Get comprehensive stats for the vendor dashboard
 * @route   GET /api/v1/vendor/dashboard/stats
 * @access  Private (Vendor)
 */
export const getVendorDashboardStats = asyncHandler(async (req, res) => {
    const stats = await VendorService.getVendorDashboardStats(req.user._id);
    return res.status(200).json(new ApiResponse(200, stats, "Vendor dashboard stats fetched successfully"));
});

/**
 * @desc    Get detailed inventory report for vendor
 * @route   GET /api/v1/vendor/inventory/report
 * @access  Private (Vendor)
 */
export const getInventoryReport = asyncHandler(async (req, res) => {
    const report = await VendorService.getInventoryReport(req.user._id);
    return res.status(200).json(new ApiResponse(200, report, "Inventory report fetched successfully"));
});
