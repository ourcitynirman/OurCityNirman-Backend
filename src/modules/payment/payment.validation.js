import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const createRazorpayOrderSchema = z.object({
    addressId: objectIdSchema,
    deliveryType: z.enum(['standard', 'express', 'same_day']).default('standard'),
});

export const verifyRazorpayPaymentSchema = z.object({
    razorpay_payment_id: z.string(),
    razorpay_order_id: z.string(),
    razorpay_signature: z.string(),
    dbOrderId: objectIdSchema,
});
