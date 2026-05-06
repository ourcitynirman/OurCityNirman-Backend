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

export const createProductSchema = z.object({
    name: z.string().trim().min(1, "Product name is required").max(200),
    brand: z.string().trim().min(1, "Brand is required"),
    company: z.string().trim().optional(),
    category: objectIdSchema,
    description: z.string().trim().min(1, "Product description is required").max(1000),
    price: z.number().min(0),
    originalPrice: z.number().min(0),
    basePrice: z.number().min(0).optional().nullable(),
    quantityAvailable: z.number().int().min(0).optional(),
    featured: z.boolean().optional(),
    trending: z.boolean().optional(),
    dimensions: z.string().optional(),
    bestFor: z.string().optional(),
    attributes: z.array(z.object({
        name: z.string().min(1),
        value: z.string().min(1),
    })).optional(),
    variants: z.array(z.any()).optional(),
    offer: z.object({
        couponCode: z.string().optional(),
        description: z.string().optional(),
        validTill: z.string().optional(),
    }).optional(),
    hsn: objectIdSchema.optional(),
    igstRate: z.number().optional(),
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
    }),
});

export const updateBasePriceSchema = z.object({
    basePrice: z.number().min(0),
});

export const addReviewSchema = z.object({
    reviewId: objectIdSchema,
});

export const updateRatingSchema = z.object({
    rating: z.number().min(0).max(5),
});
