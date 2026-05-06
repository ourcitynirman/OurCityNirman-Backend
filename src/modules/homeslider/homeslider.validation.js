import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const getSlidesQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 20), z.number().int().min(1).max(100)),
    isActive: z.enum(["true", "false"]).optional(),
    sort: z.string().optional().default("order"),
});

export const idParamSchema = z.object({
    id: objectIdSchema,
});

export const createSlideSchema = z.object({
    title: z.string().min(3).max(100),
    subtitle: z.string().max(200).optional(),
    buttonText: z.string().max(50).optional(),
    link: z.string().optional(),
    order: z.preprocess((val) => (val ? parseInt(val, 10) : undefined), z.number().int().min(0).optional()),
    isActive: z.preprocess((val) => (val === "true" || val === true), z.boolean().optional().default(true)),
    duration: z.preprocess((val) => (val ? parseInt(val, 10) : undefined), z.number().int().min(1000).max(30000).optional()),
    image: z.string().optional(), // For URL fallback
});

export const updateSlideSchema = createSlideSchema.partial();

export const reorderSlidesSchema = z.object({
    slides: z.array(z.object({
        id: objectIdSchema,
        order: z.number().int().min(0),
    })).min(1),
});

export const bulkUpdateSlidesSchema = z.object({
    slideIds: z.array(objectIdSchema).min(1),
    updates: z.object({
        isActive: z.boolean().optional(),
        buttonText: z.string().max(50).optional(),
        duration: z.number().int().min(1000).max(30000).optional(),
    }),
});
