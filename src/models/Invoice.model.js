import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
    {
        invoiceNumber: {
            type: String, //INV-mmddyy-001
            required: true,
            unique: true,
            index: true,
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
      
        orderNumber: { type: String, required: true },
        orderDate:   { type: Date, required: true },
        invoiceDate: { type: Date, default: Date.now },

        seller: {
            name:         { type: String, required: true },
            address:      { type: String, required: true },
            city:         { type: String, required: true },
            state:        { type: String, required: true },
            pincode:      { type: String, required: true },
            gstin:        { type: String, required: true }
        },

        billTo: {
            name:        { type: String, required: true },
            phone:       { type: String, required: true },
            addressLine: { type: String, required: true },
            city:        { type: String, required: true },
            state:       { type: String, required: true },
            pincode:     { type: String, required: true }
        },
        
        shipTo: {
            name:        { type: String, required: true },
            phone:       { type: String, required: true },
            addressLine: { type: String, required: true },
            city:        { type: String, required: true },
            state:       { type: String, required: true },
            pincode:     { type: String, required: true }
        },

        items: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "InvoiceItem"
            }
        ],

        subtotal:       { type: Number, required: true },
        deliveryCharge: { type: Number, default: 0 },
        totalTax:       { type: Number, required: true },
        grandTotal:     { type: Number, required: true },

        paymentMethod:     { type: String, required: true },
        razorpayPaymentId: { type: String, default: null },
        
        pdfUrl: { type: String, default: null },
        
        emailSentAt: { type: Date, default: null },
        emailSentTo: { type: String, default: null },

        status: {
            type: String,
            enum: ["active", "cancelled"],
            default: "active"
        }
    },
    { timestamps: true }
);

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
