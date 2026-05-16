import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const searchSuggestionsQuerySchema = z.object({
    q: z.string().min(2, "Query too short"),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(20)),
});

export const logRecentlyViewedSchema = z.object({
    productId: z.string().min(1),
});

export const getRecentlyViewedSchema = z.object({
    productIds: z.array(z.string()).min(1, "At least one product ID is required"),
});

export const compareProductsSchema = z.object({
    productIds: z.array(z.string()).min(2, "At least 2 products required for comparison").max(4, "Maximum 4 products allowed"),
});

export const searchProductsQuerySchema = z.object({
    q: z.string().optional(),
    search: z.string().optional(),
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 12), z.number().int().min(1).max(50)),
    sort: z.string().optional().default("relevant"),
    category: z.string().optional(),
    brand: z.string().optional(),
    minPrice: z.preprocess((val) => (val ? parseFloat(val) : undefined), z.number().optional()),
    maxPrice: z.preprocess((val) => (val ? parseFloat(val) : undefined), z.number().optional()),
    inStock: z.enum(["true", "false"]).optional(),
    featured: z.enum(["true", "false"]).optional(),
    trending: z.enum(["true", "false"]).optional(),
    minRating: z.preprocess((val) => (val ? parseFloat(val) : undefined), z.number().min(0).max(5).optional()),
    minDiscount: z.preprocess((val) => (val ? parseFloat(val) : undefined), z.number().min(0).max(100).optional()),
});
