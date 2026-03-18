import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

const Counter =
    mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// Main function
export const generatePrefixedId = async (prefix) => {
    const key = prefix.toUpperCase();

    const counter = await Counter.findByIdAndUpdate(
        key,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const number = String(counter.seq).padStart(3, "0");

    return `${key}${number}`;
};


export const generateVendorId = () => generatePrefixedId("OCNVEN");
export const generateOrderId = () => generatePrefixedId("OCNORD");