import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const addReviewSchema = z.object({
    productId: objectIdSchema,
    rating: z.number().int().min(1).max(5),
    title: z.string().max(100).optional(),
    comment: z.string().min(10).max(1000),
});

export const updateReviewSchema = z.object({
    rating: z.number().int().min(1).max(5).optional(),
    title: z.string().max(100).optional(),
    comment: z.string().min(10).max(1000).optional(),
});

export const reviewIdParamSchema = z.object({
    reviewId: objectIdSchema,
});

export const productIdParamSchema = z.object({
    productId: objectIdSchema,
});

export const getProductReviewsQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(50)),
    rating: z.preprocess((val) => (val ? parseInt(val, 10) : null), z.number().int().min(1).max(5).nullable().optional()),
    sort: z.enum(["recent", "helpful", "rating_high", "rating_low"]).default("recent"),
});

export const getMyReviewsQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(50)),
});

export const adminGetAllReviewsQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 20), z.number().int().min(1).max(100)),
    status: z.enum(["active", "hidden", "flagged"]).optional(),
});

export const adminUpdateStatusSchema = z.object({
    status: z.enum(["active", "hidden", "flagged"]),
});

export const vendorResponseSchema = z.object({
    response: z.string().min(1, "Response comment is required").max(1000),
});
