import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

const imageSchema = z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    isPrimary: z.boolean().optional(),
});

export const productQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 50), z.number().int().min(1).max(100)),
    sort: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    minPrice: z.preprocess((val) => (val ? parseFloat(val) : undefined), z.number().optional()),
    maxPrice: z.preprocess((val) => (val ? parseFloat(val) : undefined), z.number().optional()),
    minRating: z.preprocess((val) => (val ? parseFloat(val) : undefined), z.number().min(0).max(5).optional()),
    inStock: z.enum(["true", "false"]).optional(),
    featured: z.enum(["true", "false"]).optional(),
    trending: z.enum(["true", "false"]).optional(),
    search: z.string().optional(),
    offer: z.enum(["true", "false"]).optional(),
    bestFor: z.string().optional(),
    vendorId: objectIdSchema.optional(),
    sku: z.string().optional(),
    after: objectIdSchema.optional(),
});

export const productIdParamSchema = z.object({
    id: objectIdSchema,
});

export const productSlugParamSchema = z.object({
    slug: z.string().trim().min(1),
});

export const productIdentifierParamSchema = z.object({
    identifier: z.string().trim().min(1),
});

export const vendorIdParamSchema = z.object({
    vendorId: z.string().optional(),
});

// Helper: coerce FormData strings to numbers (FormData always sends strings)
const coerceNum = (fallback) => z.preprocess(
    (val) => {
        if (val === undefined || val === null || val === '') return fallback;
        const n = Number(val);
        return isNaN(n) ? fallback : n;
    },
    z.number()
);
const coerceInt = (fallback) => z.preprocess(
    (val) => {
        if (val === undefined || val === null || val === '') return fallback;
        const n = parseInt(String(val), 10);
        return isNaN(n) ? fallback : n;
    },
    z.number().int()
);

export const createProductSchema = z.object({
    name: z.string().trim().min(1, "Product name is required").max(200),
    brand: z.string().trim().min(1, "Brand is required"),
    company: z.string().trim().optional(),
    category: objectIdSchema,
    description: z.string().trim().min(1, "Product description is required").max(2000),
    keyFeatures: z.preprocess((val) => {
        if (typeof val === 'string') return [val];
        return val;
    }, z.array(z.string())).optional(),
    tags: z.preprocess((val) => {
        if (typeof val === 'string') return [val];
        return val;
    }, z.array(z.string())).optional(),
    price: coerceNum(undefined).pipe(z.number().min(0)),
    originalPrice: coerceNum(undefined).pipe(z.number().min(0)).optional(),
    basePrice: coerceNum(undefined).pipe(z.number().min(0)).optional().nullable(),
    quantityAvailable: coerceInt(0).pipe(z.number().min(0)),
    unit: z.string().optional().default('Piece'),
    minOrder: coerceInt(1).pipe(z.number().min(1)).optional(),
    weight: coerceNum(0).pipe(z.number().min(0)).optional(),
    dimensions: z.string().optional(),
    material: z.string().optional(),
    warranty: z.string().optional(),
    origin: z.string().optional(),
    bestFor: z.string().optional(),
    featured: z.preprocess((v) => v === 'true' || v === true, z.boolean().optional()),
    trending: z.preprocess((v) => v === 'true' || v === true, z.boolean().optional()),
    attributes: z.preprocess((val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch (e) { return val; }
        }
        return val;
    }, z.array(z.object({
        name: z.string().min(1),
        value: z.string().min(1),
    }))).optional(),
    hsn: objectIdSchema.optional(),
    images: z.array(z.union([z.string().url(), imageSchema])).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
    isActive: z.boolean().optional(),
});

export const bulkUpdateProductsSchema = z.object({
    productIds: z.array(objectIdSchema),
    updates: z.object({
        featured: z.boolean().optional(),
        trending: z.boolean().optional(),
        isActive: z.boolean().optional(),
        discount: z.number().optional(),
        isPopular: z.boolean().optional(),
        isApproved: z.boolean().optional(),
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
    }),
});

export const updateBasePriceSchema = z.object({
    basePrice: z.preprocess(
        (val) => (val !== undefined && val !== '' ? Number(val) : undefined),
        z.number().min(0)
    ),
});

export const addReviewSchema = z.object({
    reviewId: objectIdSchema,
});

export const updateRatingSchema = z.object({
    rating: z.number().min(0).max(5),
});
