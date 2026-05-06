import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const getMyInvoicesQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(100)),
});

export const orderIdParamSchema = z.object({
    orderId: objectIdSchema,
});

export const invoiceIdParamSchema = z.object({
    invoiceId: objectIdSchema,
});
