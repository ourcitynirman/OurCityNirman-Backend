import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const createHSNSchema = z.object({
    hsn_code: z.string().min(1, "HSN code is required").toUpperCase().trim(),
    description: z.string().max(500).optional(),
    category: objectIdSchema,
    gst_rate: z.enum([0, 5, 12, 18, 28].map(String)).or(z.number().refine(n => [0, 5, 12, 18, 28].includes(n))),
    unit: z.enum(['pcs', 'kg', 'litre', 'meter']),
});

export const getAllHSNQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(100)),
    search: z.string().optional(),
    gst_rate: z.preprocess((val) => (val ? parseInt(val, 10) : undefined), z.number().optional()),
    category: z.string().optional(),
    sort: z.string().optional(),
});

export const idParamSchema = z.object({
    id: objectIdSchema,
});

export const updateHSNSchema = createHSNSchema.partial().extend({
    is_active: z.boolean().optional(),
});

export const bulkInsertHSNSchema = z.object({
    hsn_list: z.array(createHSNSchema).min(1),
});
