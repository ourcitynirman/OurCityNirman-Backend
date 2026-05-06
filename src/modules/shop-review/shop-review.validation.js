import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const addShopReviewSchema = z.object({
    shopId: objectIdSchema,
    rating: z.number().int().min(1).max(5),
    title: z.string().max(100).optional(),
    comment: z.string().min(10).max(1000),
});

export const getShopReviewsQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(50)),
    sort: z.enum(["recent", "helpful", "rating_high", "rating_low"]).default("recent"),
});

export const reviewIdParamSchema = z.object({
    reviewId: objectIdSchema,
});

export const shopIdParamSchema = z.object({
    shopId: objectIdSchema,
});

export const updateShopReviewSchema = z.object({
    rating: z.number().int().min(1).max(5).optional(),
    title: z.string().max(100).optional(),
    comment: z.string().min(10).max(1000).optional(),
});

export const vendorResponseSchema = z.object({
    response: z.string().min(1).max(1000),
});
