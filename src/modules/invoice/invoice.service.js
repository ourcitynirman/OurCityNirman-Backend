import puppeteer from 'puppeteer';
import Invoice from './invoice.model.js';
import InvoiceItem from './invoice-item.model.js';
import HSN from '../hsn/hsn.model.js';
import {
    getStateFromGSTIN,
    isInterStateTransaction,
    calculateGSTBreakdown
} from '../../shared/utils/gst.utils.js';
import { Counter } from '../../shared/models/counter.model.js';
import { uploadStream } from '../../shared/utils/cloudinary.js';
import { sendMail } from '../../shared/services/mail.service.js';
import { generateInvoiceHtml } from '../../shared/utils/invoiceTemplate.js';
import Product from '../products/product.model.js';
import OrderItem from '../orders/order-item.model.js';
import Order from '../orders/order.model.js';
import { User } from '../auth/user.model.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { ROLES } from '../../shared/constants/roles.js';

class InvoiceService {
    static async createAndSendInvoice(order, user) {
        try {
            const items = await OrderItem.find({ order_id: order._id });
            const invoiceDate = new Date();
            const yy = String(invoiceDate.getFullYear()).slice(-2);
            const mm = String(invoiceDate.getMonth() + 1).padStart(2, '0');
            const dd = String(invoiceDate.getDate()).padStart(2, '0');
            const datePart = `${mm}${dd}${yy}`;

            const counterId = `invoice_${datePart}`;
            const counter = await Counter.findByIdAndUpdate(counterId, { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true });
            
            const sequencePart = String(counter.seq).padStart(3, '0');
            const invoiceNumber = `INV-${datePart}-${sequencePart}`;

            // 1. Identify Seller Info (Vendor details)
            let sellerInfo = {
                name: process.env.SELLER_NAME || "OurCityNirman Pvt. Ltd.",
                address: process.env.SELLER_ADDRESS || "At - Simanpur, Post - Sadipur, Ps - Pirpainti, Dist - Bhagalpur",
                city: process.env.SELLER_CITY || "Bhagalpur",
                state: process.env.SELLER_STATE || "Bihar",
                pincode: process.env.SELLER_PINCODE || "813209",
                gstin: process.env.SELLER_GSTIN || "YOUR_GSTIN_HERE"
            };

            const firstVendorId = items[0]?.vendor;
            if (firstVendorId) {
                const Shop = (await import('../shop/shop.model.js')).default;
                const shop = await Shop.findOne({ vendor: firstVendorId });
                if (shop) {
                    sellerInfo = {
                        name: shop.shopname || sellerInfo.name,
                        address: [shop.address?.landmark, shop.address?.village].filter(Boolean).join(", ") || sellerInfo.address,
                        city: shop.address?.city || sellerInfo.city,
                        state: shop.address?.state || sellerInfo.state,
                        pincode: shop.address?.pincode || sellerInfo.pincode,
                        gstin: shop.gstNumber || sellerInfo.gstin
                    };
                }
            }

            // 2. Identify States & Transaction Type
            const vendorState = sellerInfo.state || getStateFromGSTIN(sellerInfo.gstin) || "Bihar";
            const shippingState = order.deliveryAddress?.state || "Bihar";
            const isInter = isInterStateTransaction(vendorState, shippingState, sellerInfo.pincode, order.deliveryAddress?.pincode);

            const enrichedItems = await Promise.all(items.map(async (item) => {
                const product = await Product.findById(item.product).select('hsn').populate('hsn');
                
                let hsnObject = product?.hsn;
                if (!hsnObject) {
                    hsnObject = await HSN.findOne({ hsn_code: "0000" });
                }
                
                if (!hsnObject) {
                    try {
                        const Category = (await import('../category/category.model.js')).default;
                        const fallbackCat = await Category.findOne();
                        if (fallbackCat) {
                            hsnObject = await HSN.create({ 
                                hsn_code: "0000", 
                                description: "Default HSN", 
                                category: fallbackCat._id, 
                                gst_rate: 18,
                                unit: "pcs"
                            });
                        }
                    } catch (err) {
                        console.error("Failed to create fallback HSN:", err.message);
                    }
                }

                const gstRate = hsnObject?.gst_rate ?? 18;
                const breakdown = calculateGSTBreakdown(item.price, item.quantity, gstRate, isInter);
                
                return {
                    description: item.productSnapshot.name,
                    hsn: hsnObject._id,
                    hsnCode: hsnObject.hsn_code,
                    qty: item.quantity,
                    grossAmount: item.price * item.quantity,
                    discount: 0,
                    taxableValue: breakdown.taxableValue,
                    cgstRate: breakdown.cgstRate,
                    cgstAmount: breakdown.cgstAmount,
                    sgstRate: breakdown.sgstRate,
                    sgstAmount: breakdown.sgstAmount,
                    igstRate: breakdown.igstRate,
                    igstAmount: breakdown.igstAmount,
                    total: breakdown.total
                };
            }));

            const subtotal = enrichedItems.reduce((sum, i) => sum + i.taxableValue, 0);
            const totalTax = enrichedItems.reduce((sum, i) => sum + (i.cgstAmount + i.sgstAmount + i.igstAmount), 0);

            const invoiceData = {
                invoiceNumber, order: order._id, user: user._id, orderNumber: order.orderNumber, orderDate: order.createdAt, invoiceDate,
                seller: sellerInfo, billTo: { name: order.deliveryAddress.fullName, phone: order.deliveryAddress.phone, addressLine: `${order.deliveryAddress.line1}, ${order.deliveryAddress.line2 || ''}`, city: order.deliveryAddress.city, state: order.deliveryAddress.state, pincode: order.deliveryAddress.pincode },
                shipTo: { name: order.deliveryAddress.fullName, phone: order.deliveryAddress.phone, addressLine: `${order.deliveryAddress.line1}, ${order.deliveryAddress.line2 || ''}`, city: order.deliveryAddress.city, state: order.deliveryAddress.state, pincode: order.deliveryAddress.pincode },
                subtotal, deliveryCharge: Math.round(order.deliveryCharge || 0), totalTax, grandTotal: Math.round(order.totalAmount), paymentMethod: order.paymentMethod, razorpayPaymentId: order.razorpayPaymentId
            };

            const invoice = await Invoice.create(invoiceData);
            const createdItems = await InvoiceItem.insertMany(enrichedItems.map(item => ({ ...item, invoice: invoice._id })));
            invoice.items = createdItems.map(item => item._id);
            await invoice.save();

            const html = generateInvoiceHtml({ ...invoiceData, items: enrichedItems.map(i => ({ ...i, hsn: i.hsnCode })) });
            const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({ format: 'A4', margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }, printBackground: true });
            await browser.close();

            const uploadResult = await uploadStream(pdfBuffer, "raw");
            invoice.pdfUrl = uploadResult.url;
            await invoice.save();

            sendMail({
                to: user.email, subject: `GST Tax Invoice - ${invoiceNumber}`,
                html: `<p>Dear ${user.fullName}, Your invoice for order ${order.orderNumber} is attached.</p>`,
                attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
            }).then(() => { invoice.emailSentAt = new Date(); invoice.emailSentTo = user.email; invoice.save(); }).catch(err => console.error("Email failed:", err));

            return { success: true, invoice, pdfUrl: uploadResult.url };
        } catch (error) {
            console.error("Invoice Error:", error);
            return { success: false, error: error.message };
        }
    }

    static async getMyInvoices(userId, page, limit) {
        const skip = (page - 1) * limit;
        const [invoices, total] = await Promise.all([
            Invoice.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Invoice.countDocuments({ user: userId }),
        ]);
        return { invoices, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
    }

    static async getInvoiceByOrder(orderId, user) {
        const order = await Order.findById(orderId);
        if (!order) throw new ApiError(404, "Order not found");

        const isPurchaser = order.user.toString() === user._id.toString();
        const isAdmin = user.role === ROLES.ADMIN;
        const isVendor = await OrderItem.exists({ order_id: orderId, vendor: user._id });

        if (!isPurchaser && !isVendor && !isAdmin) throw new ApiError(403, "Access denied");

        let invoice = await Invoice.findOne({ order: orderId }).populate('items');
        if (!invoice) {
            if (!isPurchaser && !isAdmin) throw new ApiError(404, "Invoice not generated");
            const customer = await User.findById(order.user);
            const result = await this.createAndSendInvoice(order, customer);
            if (!result.success) throw new ApiError(500, "Generation failed: " + result.error);
            invoice = result.invoice;
        }
        return invoice;
    }

    static async getInvoicePdfUrl(invoiceId, user) {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) throw new ApiError(404, "Invoice not found");

        const order = await Order.findById(invoice.order);
        if (!order) throw new ApiError(404, "Order missing");

        const isPurchaser = order.user.toString() === user._id.toString();
        const isAdmin = user.role === ROLES.ADMIN;
        const isVendor = await OrderItem.exists({ order_id: order._id, vendor: user._id });

        if (!isPurchaser && !isVendor && !isAdmin) throw new ApiError(403, "Access denied");

        if (!invoice.pdfUrl) {
            if (!isPurchaser && !isAdmin) throw new ApiError(404, "PDF not available");
            const customer = await User.findById(order.user);
            const result = await this.createAndSendInvoice(order, customer);
            if (!result.success) throw new ApiError(500, "Failed to regenerate");
            return result.pdfUrl;
        }
        return invoice.pdfUrl;
    }

    static async viewInvoice(invoiceId, user) {
        const invoice = await Invoice.findById(invoiceId).populate('items');
        if (!invoice) throw new ApiError(404, "Invoice not found");

        const order = await Order.findById(invoice.order);
        if (!order) throw new ApiError(404, "Order invalid");

        const isPurchaser = order.user.toString() === user._id.toString();
        const isAdmin = user.role === ROLES.ADMIN;
        const isVendor = await OrderItem.exists({ order_id: order._id, vendor: user._id });

        if (!isPurchaser && !isVendor && !isAdmin) throw new ApiError(403, "Access denied");

        return invoice;
    }

    static async resendInvoiceEmail(invoiceId, user) {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) throw new ApiError(404, "Invoice not found");

        const order = await Order.findById(invoice.order);
        if (!order) throw new ApiError(404, "Order not found");

        if (order.user.toString() !== user._id.toString() && user.role !== ROLES.ADMIN) throw new ApiError(403, "Unauthorized");

        const customer = await User.findById(order.user);
        const result = await this.createAndSendInvoice(order, customer);
        if (!result.success) throw new ApiError(500, "Failed to resend");
        return true;
    }
}

export default InvoiceService;
