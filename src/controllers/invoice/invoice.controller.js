import Invoice from "../../models/Invoice.model.js";
import Order from "../../models/Order.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAndSendInvoice } from "../../services/invoice.service.js";

export const getMyInvoices = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const invoices = await Invoice.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

    const total = await Invoice.countDocuments({ user: req.user._id });

    return res.status(200).json(
        new ApiResponse(200, {
            invoices,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        }, "Invoices fetched successfully")
    );
});

export const getInvoiceByOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    let invoice = await Invoice.findOne({ order: orderId, user: req.user._id });
    
    if (!invoice) {
        // Fallback: Try to generate if order belongs to user
        const order = await Order.findOne({ _id: orderId, user: req.user._id });
        if (!order) {
            throw new ApiError(404, "Order not found or access denied");
        }

        const result = await createAndSendInvoice(order, req.user);
        if (result.success) {
            invoice = result.invoice;
        } else {
            throw new ApiError(500, `Failed to generate invoice on demand: ${result.error}`);
        }
    }

    return res.status(200).json(
        new ApiResponse(200, invoice, "Invoice fetched successfully")
    );
});

export const downloadInvoice = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findOne({ _id: invoiceId, user: req.user._id });

    if (!invoice) throw new ApiError(404, "Invoice not found");

    if (!invoice.pdfUrl) {
        // Fallback: regenerate if missing
        const order = await Order.findById(invoice.order);
        if (!order) throw new ApiError(404, "Ordering information missing");
        
        await createAndSendInvoice(order, req.user);
        // Refresh invoice
        const updatedInvoice = await Invoice.findById(invoiceId);
        return res.redirect(updatedInvoice.pdfUrl);
    }

    return res.redirect(invoice.pdfUrl);
});

export const viewInvoice = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findOne({ _id: invoiceId, user: req.user._id });

    if (!invoice) throw new ApiError(404, "Invoice not found");

    return res.status(200).json(
        new ApiResponse(200, invoice, "Invoice details fetched")
    );
});

export const resendInvoiceEmail = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findOne({ _id: invoiceId, user: req.user._id });
    if (!invoice) throw new ApiError(404, "Invoice not found");

    const order = await Order.findById(invoice.order);
    if (!order) throw new ApiError(404, "Order not found");

    // Re-trigger the generation logic which includes email sending
    const result = await createAndSendInvoice(order, req.user);

    if (!result.success) {
        throw new ApiError(500, "Failed to resend invoice");
    }

    return res.status(200).json(
        new ApiResponse(200, null, "Invoice email resent successfully")
    );
});
