import puppeteer from 'puppeteer';
import Invoice from './invoice.model.js';
import InvoiceItem from './invoice-item.model.js';
import HSN from '../hsn/hsn.model.js';
import { Counter } from '../../shared/models/counter.model.js';
import { uploadStream } from '../../shared/utils/cloudinary.js';
import { sendMail } from '../../shared/services/mail.service.js';
import { generateInvoiceHtml } from '../../shared/utils/invoiceTemplate.js';
import Product from '../products/product.model.js';
import OrderItem from '../orders/order-item.model.js';

/**
 * Service to handle GST Tax Invoice generation and distribution
 */
export const createAndSendInvoice = async (order, user) => {
    try {
        // 1. Prepare Invoice Data
        const items = await OrderItem.find({ order_id: order._id });
        const invoiceDate = new Date();
        const yy = String(invoiceDate.getFullYear()).slice(-2);
        const mm = String(invoiceDate.getMonth() + 1).padStart(2, '0');
        const dd = String(invoiceDate.getDate()).padStart(2, '0');
        const datePart = `${mm}${dd}${yy}`;

        // Get or Update sequential counter for this specific date
        // Note: Using a unique counter key per day: invoice_MMDDYY
        const counterId = `invoice_${datePart}`;
        const counter = await Counter.findByIdAndUpdate(
            counterId,
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        
        const sequencePart = String(counter.seq).padStart(3, '0');
        const invoiceNumber = `INV-${datePart}-${sequencePart}`;

        // Fetch HSN/IGST info from products (as current items only have snippets)
        const enrichedItems = await Promise.all(items.map(async (item) => {
            const product = await Product.findById(item.product).select('hsn igstRate').populate('hsn');
            
            let hsnObject = product?.hsn;
            if (!hsnObject) {
                // Fallback: try to find a default HSN or create a dummy one if needed
                hsnObject = await HSN.findOne({ hsn_code: "0000" });
                if (!hsnObject) {
                    // Create default HSN if not exists (safety)
                    hsnObject = await HSN.create({
                        hsn_code: "0000",
                        description: "Default HSN",
                        category: "Default",
                        gst_rate: 18
                    });
                }
            }

            const hsnCode = hsnObject?.hsn_code || "0000";
            const igstRate = hsnObject?.gst_rate ?? product?.igstRate ?? 18;
            
            // IGST Calculation
            const taxableValuePerUnit = item.price / (1 + (igstRate / 100));
            const igstAmountPerUnit = item.price - taxableValuePerUnit;
            
            return {
                description:  item.productSnapshot.name,
                hsn:          hsnObject._id, // Reference to HSN model
                hsnCode:      hsnCode,      // For HTML template
                qty:          item.quantity,
                grossAmount:  item.price * item.quantity,
                discount:     0,
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

        const firstVendorId = items[0]?.vendor;
        if (firstVendorId) {
            const VendorProfile = (await import('../vendor/vendor-profile.model.js')).default;
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
            // Metadata for items (not yet saved as Refs)
            subtotal,
            deliveryCharge: Math.round(order.deliveryCharge || 0),
            totalTax,
            grandTotal: Math.round(order.totalAmount),
            paymentMethod: order.paymentMethod,
            razorpayPaymentId: order.razorpayPaymentId
        };

        // 2. SAVE TO DATABASE FIRST (Performance & Integrity)
        // This ensures the record exists even if Puppeteer/Cloudinary fails
        const invoice = await Invoice.create(invoiceData);

        const createdItems = await InvoiceItem.insertMany(
            enrichedItems.map(item => ({
                ...item,
                invoice: invoice._id
            }))
        );

        invoice.items = createdItems.map(item => item._id);
        await invoice.save();

        // 3. Render HTML String and Generate PDF (Heavy Lifting)
        // Pass the string HSN for the template
        const templateData = {
            ...invoiceData,
            items: enrichedItems.map(i => ({ ...i, hsn: i.hsnCode }))
        };
        const html = generateInvoiceHtml(templateData);

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

        // 4. Upload to Cloudinary and Update Invoice
        const uploadResult = await uploadStream(pdfBuffer, "raw");
        
        invoice.pdfUrl = uploadResult.url;
        await invoice.save();

        // 5. Send Email (Fire and forget style)
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
