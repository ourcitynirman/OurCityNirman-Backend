import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const processRefundSchema = z.object({
    reason: z.string().min(1, "Reason is required").max(500),
    amount: z.preprocess((val) => (val ? parseFloat(val) : undefined), z.number().min(0).optional()),
    notes: z.record(z.any()).optional(),
});

export const orderIdParamSchema = z.object({
    orderId: objectIdSchema,
});
