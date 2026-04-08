import puppeteer from 'puppeteer';
import Invoice from '../models/Invoice.model.js';
import { uploadStream } from '../utils/cloudinary.js';
import { sendMail } from './mail.service.js';
import { generateInvoiceHtml } from '../utils/invoiceTemplate.js';
import Product from '../models/Product.js';

/**
 * Service to handle GST Tax Invoice generation and distribution
 */
export const createAndSendInvoice = async (order, user) => {
    try {
        // 1. Prepare Invoice Data
        const invoiceDate = new Date();
        const year = invoiceDate.getFullYear();
        const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
        const day = String(invoiceDate.getDate()).padStart(2, '0');
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        const invoiceNumber = `INV-${year}${month}${day}-${randomStr}`;

        // Fetch HSN/IGST info from products (as current items only have snippets)
        const enrichedItems = await Promise.all(order.items.map(async (item) => {
            const product = await Product.findById(item.product).select('hsn igstRate');
            const hsn = product?.hsn || "0000";
            const igstRate = product?.igstRate || 18;
            
            // IGST Calculation
            // Taxable Value = price / (1 + (igstRate/100))
            const taxableValuePerUnit = item.price / (1 + (igstRate / 100));
            const igstAmountPerUnit = item.price - taxableValuePerUnit;
            
            return {
                description:  item.productSnapshot.name,
                hsn:          hsn,
                qty:          item.quantity,
                grossAmount:  item.price * item.quantity,
                discount:     0, // Currently not tracked per item in order model
                taxableValue: taxableValuePerUnit * item.quantity,
                igstRate:    igstRate,
                igstAmount:   igstAmountPerUnit * item.quantity,
                total:        item.price * item.quantity
            };
        }));

        const subtotal = enrichedItems.reduce((sum, i) => sum + i.taxableValue, 0);
        const totalTax = enrichedItems.reduce((sum, i) => sum + i.igstAmount, 0);

        // Fetch Vendor Profile for Seller Info
        let sellerInfo = {
            name:     process.env.SELLER_NAME || "OurCityNirman Pvt. Ltd.",
            address:  process.env.SELLER_ADDRESS || "At - Simanpur, Post - Sadipur, Ps - Pirpainti, Dist - Bhagalpur",
            city:     process.env.SELLER_CITY || "Bhagalpur",
            state:    process.env.SELLER_STATE || "Bihar",
            pincode:  process.env.SELLER_PINCODE || "813209",
            gstin:    process.env.SELLER_GSTIN || "YOUR_GSTIN_HERE"
        };

        const firstVendorId = order.items[0]?.vendor;
        if (firstVendorId) {
            const VendorProfile = (await import('../models/VendorProfile.js')).default;
            const vProfile = await VendorProfile.findOne({ userId: firstVendorId });
            if (vProfile) {
                sellerInfo = {
                    name:     vProfile.businessName || sellerInfo.name,
                    address:  vProfile.businessAddress?.street || sellerInfo.address,
                    city:     vProfile.businessAddress?.city || sellerInfo.city,
                    state:    vProfile.businessAddress?.state || sellerInfo.state,
                    pincode:  vProfile.businessAddress?.zipCode || sellerInfo.pincode,
                    gstin:    vProfile.gstNumber || sellerInfo.gstin
                };
            }
        }

        const invoiceData = {
            invoiceNumber,
            order: order._id,
            user: user._id,
            orderNumber: order.orderNumber,
            orderDate: order.createdAt,
            invoiceDate,
            seller: sellerInfo,
            billTo: {
                name:        order.deliveryAddress.fullName,
                phone:       order.deliveryAddress.phone,
                addressLine: `${order.deliveryAddress.line1}, ${order.deliveryAddress.line2 || ''}`,
                city:        order.deliveryAddress.city,
                state:       order.deliveryAddress.state,
                pincode:     order.deliveryAddress.pincode
            },
            shipTo: {
                name:        order.deliveryAddress.fullName,
                phone:       order.deliveryAddress.phone,
                addressLine: `${order.deliveryAddress.line1}, ${order.deliveryAddress.line2 || ''}`,
                city:        order.deliveryAddress.city,
                state:       order.deliveryAddress.state,
                pincode:     order.deliveryAddress.pincode
            },
            items: enrichedItems,
            subtotal,
            deliveryCharge: Math.round(order.deliveryCharge || 0),
            totalTax,
            grandTotal: Math.round(order.totalAmount),
            paymentMethod: order.paymentMethod,
            razorpayPaymentId: order.razorpayPaymentId
        };

        // 2. Render HTML String
        const html = generateInvoiceHtml(invoiceData);

        // 3. Generate PDF Buffer with Puppeteer
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
            printBackground: true
        });
        await browser.close();

        // 4. Upload to Cloudinary
        const uploadResult = await uploadStream(pdfBuffer, "raw");
        invoiceData.pdfUrl = uploadResult.url;

        // 5. Save to Database
        const invoice = await Invoice.create(invoiceData);

        // 6. Send Email (Fire and forget style)
        sendMail({
            to: user.email,
            subject: `GST Tax Invoice - ${invoiceNumber} | OurCityNirman`,
            html: `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <h2>Thank you for your order!</h2>
                    <p>Dear ${user.fullName || 'Customer'},</p>
                    <p>Your payment for order <b>${order.orderNumber}</b> was successful. Please find your GST tax invoice attached to this email.</p>
                    <p>You can also view and download your invoice at any time from your account dashboard on OurCityNirman.</p>
                    <br/>
                    <p>Best Regards,<br/>Team OurCityNirman</p>
                </div>
            `,
            attachments: [
                {
                    filename: `${invoiceNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        }).then(() => {
            invoice.emailSentAt = new Date();
            invoice.emailSentTo = user.email;
            invoice.save();
        }).catch(err => console.error("Invoice Email Send Error:", err));

        return { success: true, invoice, pdfUrl: uploadResult.url };

    } catch (error) {
        console.error("Critical Invoice Generation Error:", error);
        return { success: false, error: error.message };
    }
};
