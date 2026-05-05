import { Counter } from "../../shared/models/counter.model.js";

// Main function
export const generatePrefixedId = async (prefix) => {
    const key = prefix.toUpperCase();

    const counter = await Counter.findByIdAndUpdate(
        key,
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );

    const number = String(counter.seq).padStart(3, "0");

    return `${key}${number}`;
};


export const generateVendorId = () => generatePrefixedId("OCNVEN");
export const generateOrderId = () => generatePrefixedId("OCNORD");