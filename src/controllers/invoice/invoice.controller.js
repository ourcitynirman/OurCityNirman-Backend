import Invoice from "../../models/Invoice.model.js";
import { User } from "../../models/user.model.js";
import Order from "../../models/Order.model.js";
import OrderItem from "../../models/OrderItem.model.js";
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

    // Check if user is purchaser, vendor of this order, or admin
    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, "Order not found");

    const isPurchaser = order.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    
    // Check vendor access via OrderItem
    const isVendor = await OrderItem.exists({ order_id: orderId, vendor: req.user._id });

    if (!isPurchaser && !isVendor && !isAdmin) {
        throw new ApiError(403, "Access denied to this order's invoice");
    }

    let invoice = await Invoice.findOne({ order: orderId });
    
    if (!invoice) {
        // Only generate if user is purchaser or admin
        if (!isPurchaser && !isAdmin) {
            throw new ApiError(404, "Invoice not generated yet");
        }

        const customer = await User.findById(order.user);
        if (!customer) throw new ApiError(404, "Customer not found for this order");

        const result = await createAndSendInvoice(order, customer);
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

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new ApiError(404, "Invoice not found");

    const order = await Order.findById(invoice.order);
    if (!order) throw new ApiError(404, "Ordering information missing");

    const isPurchaser = order.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    
    // Check vendor access via OrderItem
    const isVendor = await OrderItem.exists({ order_id: order._id, vendor: req.user._id });

    if (!isPurchaser && !isVendor && !isAdmin) {
        throw new ApiError(403, "Access denied to download this invoice");
    }

    if (!invoice.pdfUrl) {
        // Fallback: regenerate if missing and user is purchaser/admin
        if (!isPurchaser && !isAdmin) {
            throw new ApiError(404, "Invoice PDF not available");
        }
        
        const customer = await User.findById(order.user);
        if (!customer) throw new ApiError(404, "Customer not found");

        const result = await createAndSendInvoice(order, customer);
        if (!result.success) throw new ApiError(500, "Failed to regenerate invoice");
        return res.redirect(result.pdfUrl);
    }

    return res.redirect(invoice.pdfUrl);
});

export const viewInvoice = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new ApiError(404, "Invoice not found");

    const order = await Order.findById(invoice.order);
    if (!order) throw new ApiError(404, "Order info invalid");

    const isPurchaser = order.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    
    // Check vendor access via OrderItem
    const isVendor = await OrderItem.exists({ order_id: order._id, vendor: req.user._id });

    if (!isPurchaser && !isVendor && !isAdmin) {
        throw new ApiError(403, "Access denied to view this invoice");
    }

    return res.status(200).json(
        new ApiResponse(200, invoice, "Invoice details fetched")
    );
});

export const resendInvoiceEmail = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new ApiError(404, "Invoice not found");

    const order = await Order.findById(invoice.order);
    if (!order) throw new ApiError(404, "Order not found");

    // Only purchaser or admin can resend to user email
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        throw new ApiError(403, "Access denied: Only the purchaser or admin can trigger email resends");
    }

    const customer = await User.findById(order.user);
    if (!customer) throw new ApiError(404, "Customer not found");

    const result = await createAndSendInvoice(order, customer);

    if (!result.success) {
        throw new ApiError(500, "Failed to resend invoice");
    }

    return res.status(200).json(
        new ApiResponse(200, null, "Invoice email resent successfully")
    );
});
