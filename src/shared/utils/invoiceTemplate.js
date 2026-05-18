export const generateInvoiceHtml = (data) => {
    const {
        invoiceNumber, orderNumber, orderDate, invoiceDate,
        seller, billTo, shipTo, items, 
        subtotal, deliveryCharge, totalTax, grandTotal,
        paymentMethod, razorpayPaymentId
    } = data;

    const isInterState = items.some(item => (item.igstAmount || 0) > 0);
    const totalCGST = items.reduce((sum, item) => sum + (item.cgstAmount || 0), 0);
    const totalSGST = items.reduce((sum, item) => sum + (item.sgstAmount || 0), 0);
    const totalIGST = items.reduce((sum, item) => sum + (item.igstAmount || 0), 0);

    const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    const itemsHtml = items.map((item, index) => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; text-align: center;">${index + 1}</td>
            <td style="padding: 8px;">
                <div style="font-weight: bold; color: #333;">${item.description}</div>
            </td>
            <td style="padding: 8px; text-align: center;">${item.hsn}</td>
            <td style="padding: 8px; text-align: center;">${item.qty}</td>
            <td style="padding: 8px; text-align: right;">₹${item.grossAmount.toFixed(2)}</td>
            <td style="padding: 8px; text-align: right;">₹${item.discount.toFixed(2)}</td>
            <td style="padding: 8px; text-align: right;">₹${item.taxableValue.toFixed(2)}</td>
            ${isInterState ? `
                <td style="padding: 8px; text-align: right;">${item.igstRate}% (₹${item.igstAmount.toFixed(2)})</td>
            ` : `
                <td style="padding: 8px; text-align: right;">${item.cgstRate}% (₹${item.cgstAmount.toFixed(2)})</td>
                <td style="padding: 8px; text-align: right;">${item.sgstRate}% (₹${item.sgstAmount.toFixed(2)})</td>
            `}
            <td style="padding: 8px; text-align: right; font-weight: bold;">₹${item.total.toFixed(2)}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; line-height: 1.4; color: #444; margin: 0; padding: 0; }
        .invoice-container { padding: 40px; }
        .header { background: #1a237e; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
        .tag { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 4px; font-size: 12px; }
        
        .meta-row { background: #f5f5f5; padding: 15px 20px; display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 20px; border-bottom: 1px solid #ddd; }
        .meta-item b { color: #1a237e; display: block; font-size: 11px; text-transform: uppercase; margin-bottom: 2px; }
        
        .address-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .address-box h3 { font-size: 12px; text-transform: uppercase; color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 5px; margin-bottom: 10px; }
        .address-box p { margin: 0; font-size: 13px; color: #555; }
        
        .payment-bar { background: #e8f5e9; border: 1px solid #c8e6c9; padding: 10px 20px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .paid-badge { color: #2e7d32; font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 5px; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f8f9fa; color: #1a237e; font-size: 11px; text-transform: uppercase; padding: 12px 8px; border-bottom: 2px solid #dee2e6; text-align: left; }
        td { font-size: 12px; vertical-align: top; }
        
        .summary-box { float: right; width: 300px; }
        .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; }
        .grand-total { background: #1a237e; color: white; padding: 12px; margin-top: 10px; border-radius: 4px; font-weight: bold; font-size: 16px; }
        
        .footer { clear: both; margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #999; }
        .gst-notes { margin-top: 10px; font-style: italic; }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div>
                <h1>${seller.name}</h1>
                <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">Building Our City Together</div>
            </div>
            <div>
                <div class="tag">Tax Invoice</div>
                <div style="font-size: 10px; text-align: right; margin-top: 5px;">Original For Recipient</div>
            </div>
        </div>

        <div class="meta-row">
            <div class="meta-item"><b>Order Number</b> ${orderNumber}</div>
            <div class="meta-item"><b>Order Date</b> ${formatDate(orderDate)}</div>
            <div class="meta-item"><b>Invoice Number</b> ${invoiceNumber}</div>
            <div class="meta-item"><b>Invoice Date</b> ${formatDate(invoiceDate)}</div>
        </div>

        <div class="address-section">
            <div class="address-box">
                <h3>Sold By</h3>
                <p><strong>${seller.name}</strong></p>
                <p>${seller.address}</p>
                <p>${seller.city}, ${seller.state} - ${seller.pincode}</p>
                <p style="margin-top: 5px;"><strong>GSTIN:</strong> ${seller.gstin}</p>
            </div>
            <div class="address-box">
                <h3>Billing Address</h3>
                <p><strong>${billTo.name}</strong></p>
                <p>${billTo.phone}</p>
                <p>${billTo.addressLine}</p>
                <p>${billTo.city}, ${billTo.state} - ${billTo.pincode}</p>
            </div>
            <div class="address-box">
                <h3>Shipping Address</h3>
                <p><strong>${shipTo.name}</strong></p>
                <p>${shipTo.phone}</p>
                <p>${shipTo.addressLine}</p>
                <p>${shipTo.city}, ${shipTo.state} - ${shipTo.pincode}</p>
            </div>
        </div>

        <div class="payment-bar">
            <div style="font-size: 13px; color: #555;">
                <strong>Payment:</strong> ${paymentMethod} | <strong>Transaction ID:</strong> ${razorpayPaymentId || 'N/A'}
            </div>
            <div class="paid-badge">✓ PAID</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">SN</th>
                    <th>Item Description</th>
                    <th style="text-align: center;">HSN</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Rate</th>
                    <th style="text-align: right;">Disc.</th>
                    <th style="text-align: right;">Taxable</th>
                    ${isInterState ? `
                        <th style="text-align: right;">IGST</th>
                    ` : `
                        <th style="text-align: right;">CGST</th>
                        <th style="text-align: right;">SGST</th>
                    `}
                    <th style="text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div class="summary-box">
            <div class="summary-row">
                <span>Sub-total (Excl. Tax)</span>
                <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ${isInterState ? `
                <div class="summary-row">
                    <span>Total IGST (Tax)</span>
                    <span>₹${totalIGST.toFixed(2)}</span>
                </div>
            ` : `
                <div class="summary-row">
                    <span>Total CGST</span>
                    <span>₹${totalCGST.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Total SGST</span>
                    <span>₹${totalSGST.toFixed(2)}</span>
                </div>
            `}
            <div class="summary-row">
                <span>Shipping & Delivery</span>
                <span>₹${deliveryCharge.toFixed(2)}</span>
            </div>
            <div class="grand-total">
                <div style="display: flex; justify-content: space-between;">
                    <span>Grand Total</span>
                    <span>₹${grandTotal.toFixed(2)}</span>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>At - Simanpur, Post - Sadipur, Ps - Pirpainti, Dist - Bhagalpur, Bihar - 813209</p>
            <p><strong>GSTIN:</strong> ${seller.gstin} | <strong>CIN:</strong> U74999BR2024PTC068541</p>
            <div class="gst-notes">
                * Tax not payable on reverse charge basis.<br>
                * This is a computer generated invoice and does not require a physical signature.
            </div>
            <p style="margin-top: 15px; font-weight: bold;">Thank you for choosing OurCityNirman!</p>
        </div>
    </div>
</body>
</html>
    `;
};
