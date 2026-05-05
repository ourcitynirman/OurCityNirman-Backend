import { Counter } from "../../shared/models/counter.model.js";

/**
 * @desc    Generate a random numeric OTP of specified length
 */
export const generateOTP = (length = 6) => {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

/**
 * @desc    Generate a sequential ID with a prefix (stored in DB counter)
 */
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
