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

export const categoryIdParamSchema = z.object({
    id: objectIdSchema.refine(val => val !== null, "ID is required"),
});

export const parentIdParamSchema = z.object({
    parentId: objectIdSchema,
});

export const getCategoryTreeQuerySchema = z.object({
    rootId: objectIdSchema.optional().nullable(),
    includeInactive: z.enum(["true", "false"]).optional(),
});

export const includeInactiveQuerySchema = z.object({
    includeInactive: z.enum(["true", "false"]).optional(),
});

export const createCategorySchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name cannot exceed 100 characters"),
    description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
    image: z.any().optional().nullable(),
    icon: z.any().optional().nullable(),
    banner: z.any().optional().nullable(),
    parent: objectIdSchema.optional().nullable(),
    sortOrder: z.preprocess((val) => (val !== undefined ? Number(val) : 0), z.number().int().optional()),
    featured: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
    seo: z.preprocess((val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return {}; }
        }
        return val;
    }, z.object({
        metaTitle: z.string().trim().max(100).optional().nullable(),
        metaDescription: z.string().trim().max(300).optional().nullable(),
        keywords: z.string().trim().optional().nullable(),
    }).optional().nullable()),
});

export const updateCategorySchema = z.object({
    name: z.string().trim().min(1, "Name cannot be empty").max(100).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    image: z.any().optional().nullable(),
    icon: z.any().optional().nullable(),
    banner: z.any().optional().nullable(),
    parent: objectIdSchema.optional().nullable(),
    sortOrder: z.preprocess((val) => (val !== undefined ? Number(val) : undefined), z.number().int().optional()),
    featured: z.preprocess((val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return val;
    }, z.boolean().optional()),
    seo: z.preprocess((val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return undefined; }
        }
        return val;
    }, z.object({
        metaTitle: z.string().trim().max(100).optional().nullable(),
        metaDescription: z.string().trim().max(300).optional().nullable(),
        keywords: z.string().trim().optional().nullable(),
    }).optional().nullable()),
    isActive: z.preprocess((val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return val;
    }, z.boolean().optional()),
});
