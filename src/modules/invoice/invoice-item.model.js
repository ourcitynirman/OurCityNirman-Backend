import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema(
    {
        invoice: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Invoice",
            required: true,
            index: true
        },
        description: {
            type: String,
            required: true,
            trim: true
        },
        hsn: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "HSN",
            required: true
        },
        qty: {
            type: Number,
            required: true,
            min: [1, "Quantity cannot be less than 1"]
        },
        grossAmount: {
            type: Number,
            required: true
        },
        discount: {
            type: Number,
            default: 0
        },
        taxableValue: {
            type: Number,
            required: true
        },
        igstRate: {
            type: Number,
            default: 18
        },
        igstAmount: {
            type: Number,
            required: true
        },
        total: {
            type: Number,
            required: true
        }
    },
    { timestamps: true }
);

const InvoiceItem = mongoose.model("InvoiceItem", invoiceItemSchema);
export default InvoiceItem;
