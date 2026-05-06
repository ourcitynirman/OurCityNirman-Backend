import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const getUsersQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(100)),
    role: z.string().optional(),
    isActive: z.enum(["true", "false"]).optional(),
    isVerified: z.enum(["true", "false"]).optional(),
    search: z.string().optional(),
    sort: z.string().optional().default("-createdAt"),
});

export const idParamSchema = z.object({
    id: objectIdSchema,
});

export const blockProductSchema = z.object({
    reason: z.string().max(300).optional(),
});

export const getAdminOrdersQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(100)),
    status: z.string().optional(),
    paymentStatus: z.string().optional(),
    paymentMethod: z.string().optional(),
    userId: z.string().optional(),
    vendorId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sort: z.string().optional().default("-createdAt"),
});

export const overrideOrderStatusSchema = z.object({
    status: z.enum(['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
    note: z.string().max(300).optional(),
});

export const getFinancialReportQuerySchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

export const bulkApproveProductsSchema = z.object({
    productIds: z.array(objectIdSchema).min(1, "At least one product ID is required"),
});
