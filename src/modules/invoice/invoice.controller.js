import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import InvoiceService from "./invoice.service.js";
import { getMyInvoicesQuerySchema, orderIdParamSchema, invoiceIdParamSchema } from "./invoice.validation.js";

/**
 * @desc    Get all invoices for the currently logged-in user
 * @route   GET /api/v1/invoice/my-invoices
 * @access  Private
 */
export const getMyInvoices = asyncHandler(async (req, res, next) => {
    try {
        const { page, limit } = getMyInvoicesQuerySchema.parse(req.query);
        const result = await InvoiceService.getMyInvoices(req.user._id, page, limit);
        return res.status(200).json(new ApiResponse(200, result, "Invoices fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get invoice details for a specific order ID
 * @route   GET /api/v1/invoice/order/:orderId
 * @access  Private (Owner/Vendor/Admin)
 */
export const getInvoiceByOrder = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = orderIdParamSchema.parse(req.params);
        const result = await InvoiceService.getInvoiceByOrder(orderId, req.user);
        return res.status(200).json(new ApiResponse(200, result, "Invoice fetched successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Download invoice PDF or get PDF URL
 * @route   GET /api/v1/invoice/:invoiceId/download
 * @access  Private (Owner/Vendor/Admin)
 */
export const downloadInvoice = asyncHandler(async (req, res, next) => {
    try {
        const { invoiceId } = invoiceIdParamSchema.parse(req.params);
        const pdfUrl = await InvoiceService.getInvoicePdfUrl(invoiceId, req.user);
        return res.redirect(pdfUrl);
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Get full details of a specific invoice
 * @route   GET /api/v1/invoice/:invoiceId/view
 * @access  Private (Owner/Vendor/Admin)
 */
export const viewInvoice = asyncHandler(async (req, res, next) => {
    try {
        const { invoiceId } = invoiceIdParamSchema.parse(req.params);
        const result = await InvoiceService.viewInvoice(invoiceId, req.user);
        return res.status(200).json(new ApiResponse(200, result, "Invoice details fetched"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Resend invoice PDF to customer's email
 * @route   POST /api/v1/invoice/:invoiceId/resend-email
 * @access  Private (Owner/Admin)
 */
export const resendInvoiceEmail = asyncHandler(async (req, res, next) => {
    try {
        const { invoiceId } = invoiceIdParamSchema.parse(req.params);
        await InvoiceService.resendInvoiceEmail(invoiceId, req.user);
        return res.status(200).json(new ApiResponse(200, null, "Invoice email resent successfully"));
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});
