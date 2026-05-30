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
    storeType: z.enum(["retailer", "wholesaler", "manufacturer", "distributor", "service_provider", "other"]).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    tagline: z.string().min(2, "Tagline is required").max(150),
    phone: z.string().optional().nullable(),
    alternativephone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    website: z.string().optional().nullable(),
    gstNumber: z.string().optional().nullable(),
    address: z.preprocess((val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return val; }
        }
        return val;
    }, addressSchema.optional()),
    financeOptions: z.preprocess((val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return val; }
        }
        return val;
    }, z.array(z.string()).optional().default([])),
    deliveryAreas: z.preprocess((val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return val; }
        }
        return val;
    }, z.array(z.object({
        pincode: z.string(),
        areaName: z.string(),
        district: z.string(),
        state: z.string()
    })).optional().default([])),
    availability: z.preprocess((val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return val; }
        }
        return val;
    }, availabilitySchema.optional()),
    panNumber: z.string().optional().nullable(),
    whatsapp: z.string().optional().nullable(),
    bankDetails: z.preprocess((val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return val; }
        }
        return val;
    }, z.object({
        accountNumber: z.string().optional(),
        ifscCode: z.string().optional(),
        accountHolderName: z.string().optional(),
        bankName: z.string().optional()
    }).optional()),
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
    status: z.enum(["all", "pending", "approved", "rejected"]).optional(),
});

// ─── Vendor specific schemas ──────────────────────────────────────────────────
export const vendorStatsQuerySchema = z.object({});
export const inventoryReportQuerySchema = z.object({});

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

