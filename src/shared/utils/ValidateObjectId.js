import mongoose, { Types } from "mongoose";
import ApiError from "./ApiError.js";


const validateObjectId = (value, fieldName = "id") => {

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

export default validateObjectId;