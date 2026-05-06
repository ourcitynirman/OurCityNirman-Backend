import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const updateStockSchema = z.object({
    quantity: z.number().int(),
    operation: z.enum(['set', 'add', 'subtract']).default('set'),
});

export const productIdParamSchema = z.object({
    productId: objectIdSchema,
});
