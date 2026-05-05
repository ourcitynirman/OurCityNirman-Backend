import { Router } from "express";
import { 
    getMyInvoices, 
    getInvoiceByOrder, 
    downloadInvoice, 
    viewInvoice,
    resendInvoiceEmail
} from "./invoice.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @desc    Get all invoices for the currently logged-in user
 * @route   GET /api/v1/invoice/my-invoices
 * @access  Private
 */
router.get("/my-invoices", getMyInvoices);

/**
 * @desc    Get invoice details for a specific order ID
 * @route   GET /api/v1/invoice/order/:orderId
 * @access  Private (Owner/Vendor/Admin)
 */
router.get("/order/:orderId", getInvoiceByOrder);

/**
 * @desc    Get full details of a specific invoice
 * @route   GET /api/v1/invoice/:invoiceId/view
 * @access  Private (Owner/Vendor/Admin)
 */
router.get("/:invoiceId/view", viewInvoice);

/**
 * @desc    Download invoice PDF or get PDF URL
 * @route   GET /api/v1/invoice/:invoiceId/download
 * @access  Private (Owner/Vendor/Admin)
 */
router.get("/:invoiceId/download", downloadInvoice);

/**
 * @desc    Resend invoice PDF to customer's email
 * @route   POST /api/v1/invoice/:invoiceId/resend-email
 * @access  Private (Owner/Admin)
 */
router.post("/:invoiceId/resend-email", resendInvoiceEmail);

export default router;
