import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

const addressSchema = z.object({
    village: z.string().optional().nullable(),
    post: z.string().optional().nullable(),
    policeStation: z.string().optional().nullable(),
    block: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    landmark: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    country: z.string().default("India"),
});

const availabilitySchema = z.object({
    openTime: z.string().optional().nullable(),
    closeTime: z.string().optional().nullable(),
    daysOpen: z.array(z.string()).optional().default(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]),
});

export const createShopSchema = z.object({
    shopname: z.string().min(2).max(100),
    category: objectIdSchema,
    storeType: z.enum(["Retail", "Wholesale", "Manufacturer", "Distributor", "Service Provider"]).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    tagline: z.string().max(150).optional().nullable(),
    phone: z.string().optional().nullable(),
    alternativephone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    website: z.string().url().optional().nullable(),
    gstNumber: z.string().optional().nullable(),
    address: addressSchema.optional(),
    financeOptions: z.array(z.string()).optional().default([]),
    deliveryAreas: z.array(z.string()).optional().default([]),
    availability: availabilitySchema.optional(),
});

export const updateShopSchema = createShopSchema.partial();

export const shopIdParamSchema = z.object({
    shopId: objectIdSchema,
});

export const shopSlugParamSchema = z.object({
    slug: z.string(),
});

export const shopCodeParamSchema = z.object({
    shopCode: z.string(),
});

export const verifyShopSchema = z.object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().max(500).optional(),
});

export const shopQuerySchema = z.object({
    category: z.string().optional(),
    isVerified: z.enum(["true", "false"]).optional(),
    search: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(50)),
    sortBy: z.enum(["createdAt", "rating.average", "totalOrders", "totalProducts"]).default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
});

export const adminShopQuerySchema = shopQuerySchema.extend({
    isActive: z.enum(["true", "false"]).optional(),
    verificationStatus: z.enum(["pending", "approved", "rejected", "not_requested"]).optional(),
});
