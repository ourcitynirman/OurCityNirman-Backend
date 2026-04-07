import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
    {
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
            index: true
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
                description:  { type: String, required: true },
                hsn:          { type: String, default: "0000" },
                qty:          { type: Number, required: true },
                grossAmount:  { type: Number, required: true },
                discount:     { type: Number, default: 0 },
                taxableValue: { type: Number, required: true },
                igstRate:    { type: Number, default: 18 },
                igstAmount:   { type: Number, required: true },
                total:        { type: Number, required: true }
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
