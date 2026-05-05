import { Types } from "mongoose";
import { ApiError } from "./api.utils.js";

/**
 * @desc    Validate if a value is a valid MongoDB ObjectId
 */
export const validateObjectId = (value, fieldName = "id") => {
    if (value === undefined || value === null)
        throw new ApiError(400, `${fieldName} is required`);

    if (Array.isArray(value)) {
        if (value.length === 0)
            throw new ApiError(400, `${fieldName} array cannot be empty`);
        return value.map((id) => validateObjectId(id, fieldName));
    }

    if (typeof value === "object" && !(value instanceof Types.ObjectId))
        throw new ApiError(400, `Invalid ${fieldName}`);

    const cleaned = String(value).trim();
    if (!cleaned)
        throw new ApiError(400, `${fieldName} cannot be empty`);

    if (!Types.ObjectId.isValid(cleaned))
        throw new ApiError(400, `Invalid ${fieldName}`);

    return new Types.ObjectId(cleaned);
};

/**
 * @desc    Validate Indian phone number format
 */
export const isValidPhone = (mobile) => {
    const regex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
    return regex.test(mobile);
};

/**
 * @desc    Validate email address format
 */
export const isValidEmail = (email) => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
};

/**
 * @desc    Mask an email address for privacy (e.g., a***b@example.com)
 */
export const maskEmail = (email) => {
    if (!email || !email.includes('@')) return email;
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name[0]}*@${domain}`;
    return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
};

/**
 * @desc    Mask a phone number (e.g., ******7890)
 */
export const maskPhone = (phone) => {
    if (!phone) return phone;
    const cleanPhone = phone.toString();
    if (cleanPhone.length < 4) return cleanPhone;
    return '*'.repeat(cleanPhone.length - 4) + cleanPhone.slice(-4);
};
