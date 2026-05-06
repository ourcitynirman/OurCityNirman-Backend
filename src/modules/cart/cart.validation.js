import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
});

export const addToCartSchema = z.object({
    productId: objectIdSchema,
    quantity: z.number().int().min(1).max(100).optional().default(1),
});

export const updateCartItemSchema = z.object({
    quantity: z.number().int().min(1).max(100),
});

export const paramsProductIdSchema = z.object({
    productId: objectIdSchema,
});
