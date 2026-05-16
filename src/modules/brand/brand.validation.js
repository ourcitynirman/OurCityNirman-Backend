import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.preprocess((val) => {
    if (val === "" || val === "null" || val === "undefined") return null;
    return val;
}, z.string().nullable().refine((val) => {
    if (val === null) return true;
    return mongoose.Types.ObjectId.isValid(val);
}, {
    message: "Invalid ObjectId format",
}));

export const brandQuerySchema = z.object({
    page: z.preprocess((a) => (a === undefined || a === null || a === '' ? 1 : parseInt(String(a), 10)), z.number().int().min(1).default(1)),
    limit: z.preprocess((a) => (a === undefined || a === null || a === '' ? 20 : parseInt(String(a), 10)), z.number().int().min(1).max(1000).default(20)),
    search: z.string().trim().optional(),
    isActive: z.enum(["true", "false"]).optional(),
    categoryId: z.string().optional(),
    category_id: z.string().optional(),
});

export const brandIdParamSchema = z.object({
    id: objectIdSchema,
});

export const categoryIdParamSchema = z.object({
    categoryId: objectIdSchema,
});

export const createBrandSchema = z.object({
    name: z.string().trim().min(1, "Brand name is required"),
    logo: z.string().trim().optional().nullable(),
    description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional().nullable(),
    categoryId: objectIdSchema.optional(), // Added to support frontend FormData
    categories: z.array(objectIdSchema).optional().default([]),
});

export const updateBrandSchema = z.object({
    name: z.string().trim().min(1, "Brand name cannot be empty").optional(),
    logo: z.string().trim().optional().nullable(),
    description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional().nullable(),
    categoryId: objectIdSchema.optional(), // Added to support frontend FormData
    categories: z.array(objectIdSchema).optional(),
    isActive: z.preprocess((val) => {
        if (typeof val === 'string') return val === 'true';
        return val;
    }, z.boolean().optional()),
    popularityScore: z.preprocess((val) => {
        if (val === undefined || val === "" || val === null || val === "null" || val === "undefined") return undefined;
        const res = parseInt(val, 10);
        return isNaN(res) ? undefined : res;
    }, z.number().int().min(0).optional()),
});
