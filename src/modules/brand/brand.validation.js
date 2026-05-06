import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const brandQuerySchema = z.object({
    page: z.preprocess((a) => parseInt(a, 10), z.number().int().min(1).default(1)),
    limit: z.preprocess((a) => parseInt(a, 10), z.number().int().min(1).max(100).default(20)),
    search: z.string().trim().optional(),
    isActive: z.enum(["true", "false"]).optional(),
});

export const brandIdParamSchema = z.object({
    id: objectIdSchema,
});

export const categoryIdParamSchema = z.object({
    categoryId: objectIdSchema,
});

export const createBrandSchema = z.object({
    name: z.string().trim().min(1, "Brand name is required"),
    logo: z.string().trim().url("Logo must be a valid URL").optional().nullable(),
    description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional().nullable(),
    categories: z.array(objectIdSchema).optional().default([]),
});

export const updateBrandSchema = z.object({
    name: z.string().trim().min(1, "Brand name cannot be empty").optional(),
    logo: z.string().trim().url("Logo must be a valid URL").optional().nullable(),
    description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional().nullable(),
    categories: z.array(objectIdSchema).optional(),
    isActive: z.boolean().optional(),
    popularityScore: z.number().int().min(0).optional(),
});
