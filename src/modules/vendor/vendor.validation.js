import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const vendorStatsQuerySchema = z.object({
    // No specific fields needed for now
});

export const inventoryReportQuerySchema = z.object({
    // No specific fields needed for now
});

export const vendorOrderQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(50)),
    status: z.string().optional(),
});

export const orderIdParamSchema = z.object({
    id: objectIdSchema,
});

export const updateVendorOrderStatusSchema = z.object({
    status: z.enum(['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered']),
    note: z.string().max(300).optional(),
});
