import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
});

const notificationSettingsSchema = z.object({
    orderUpdates: z.boolean().optional(),
    promotions: z.boolean().optional(),
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
});

const privacySettingsSchema = z.object({
    profileVisibility: z.enum(["public", "private", "verified-only"]).optional(),
    showPhone: z.boolean().optional(),
    showEmail: z.boolean().optional(),
});

const securitySettingsSchema = z.object({
    loginAlerts: z.boolean().optional(),
    unknownDeviceAlerts: z.boolean().optional(),
    twoFactorEnabled: z.boolean().optional(),
});

const vendorPreferencesSchema = z.object({
    autoConfirmOrders: z.boolean().optional(),
    lowStockAlerts: z.boolean().optional(),
    orderNotificationSound: z.boolean().optional(),
});

const locationPreferencesSchema = z.object({
    autoDetectLocation: z.boolean().optional(),
    maxServiceRadiusKm: z.number().int().min(1).max(100).optional(),
});

const systemSettingsSchema = z.object({
    language: z.enum(["en", "hi", "mr", "gu", "bn", "ta"]).optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
});

export const updateSettingsSchema = z.object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(4, "New password must be at least 4 characters").optional(),
    notifications: notificationSettingsSchema.optional(),
    privacy: privacySettingsSchema.optional(),
    security: securitySettingsSchema.optional(),
    vendorPreferences: vendorPreferencesSchema.optional(),
    locationPreferences: locationPreferencesSchema.optional(),
    system: systemSettingsSchema.optional(),
}).refine(data => {
    if (data.newPassword && !data.currentPassword) return false;
    return true;
}, {
    message: "Current password is required to set a new password",
    path: ["currentPassword"],
});

export const userIdParamSchema = z.object({
    userId: objectIdSchema,
});

export const adminUpdateSettingsSchema = updateSettingsSchema.extend({
    role: z.enum(["vendor", "admin"]).optional(),
});
