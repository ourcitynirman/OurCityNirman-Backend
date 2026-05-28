import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const placeOrderSchema = z.object({
    addressId: objectIdSchema,
    paymentMethod: z.enum(["online", "cod"]).default("online"),
    notes: z.string().max(500).optional(),
    deliveryType: z.enum(["standard", "express", "same_day", "pay_later"]).default("pay_later"),
});

export const orderQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(100)),
    status: z.string().optional(),
});

export const orderIdParamSchema = z.object({
    orderId: objectIdSchema,
});

export const orderItemTrackParamSchema = z.object({
    orderId: objectIdSchema,
    itemId: objectIdSchema,
});

export const cancelOrderSchema = z.object({
    reason: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
    status: z.enum(['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded']),
    note: z.string().max(300).optional(),
});

export const verifyDeliveryOTPSchema = z.object({
    otp: z.string().min(1, "OTP is required"),
});

export const updateItemTrackingSchema = z.object({
    trackingNumber: z.string().optional(),
    shippingCarrier: z.string().optional(),
    itemStatus: z.enum(['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered']).optional(),
});

export const adminOrderQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 20), z.number().int().min(1).max(100)),
    status: z.string().optional(),
    search: z.string().optional(),
    overdueOnly: z.enum(["true", "false"]).optional(),
});

export const adminCancelOrderSchema = z.object({
    reason: z.string().min(1, "Cancellation reason is required").max(500),
});
