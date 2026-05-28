import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

export const getMembersQuerySchema = z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 20), z.number().int().min(1).max(100)),
    isActive: z.enum(["true", "false"]).optional(),
    sort: z.string().optional().default("order"),
});

export const idParamSchema = z.object({
    id: objectIdSchema,
});

export const createMemberSchema = z.object({
    name: z.string().min(2).max(100),
    role: z.string().min(2).max(100),
    badge: z.string().max(50).optional().default("Team"),
    linkedin: z.string().optional().default(""),
    twitter: z.string().optional().default(""),
    order: z.preprocess(
        (val) => (val !== undefined && val !== null && val !== "" ? parseInt(val, 10) : undefined),
        z.number().int().min(0).optional()
    ),
    isActive: z.preprocess(
        (val) => (val === undefined || val === null ? undefined : (val === "true" || val === true)),
        z.boolean().optional().default(true)
    ),
    image: z.string().optional(), // For URL fallback
});

export const updateMemberSchema = createMemberSchema.partial();

export const reorderMembersSchema = z.object({
    members: z.array(z.object({
        id: objectIdSchema,
        order: z.number().int().min(0),
    })).min(1),
});

export const bulkUpdateMembersSchema = z.object({
    memberIds: z.array(objectIdSchema).min(1),
    updates: z.object({
        isActive: z.boolean().optional(),
        badge: z.string().max(50).optional(),
    }),
});
