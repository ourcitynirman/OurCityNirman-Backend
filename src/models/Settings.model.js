import mongoose from "mongoose";

const { Schema } = mongoose;

const SettingsSchema = new Schema(
    {

        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },


        role: {
            type: String,
            enum: ["vendor", "admin"],
            required: true,
            index: true,
        },


        notifications: {
            orderUpdates: { type: Boolean, default: true },
            promotions: { type: Boolean, default: false },
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
        },


        privacy: {
            profileVisibility: {
                type: String,
                enum: ["public", "private", "verified-only"],
                default: "public",
            },
            showPhone: { type: Boolean, default: false },
            showEmail: { type: Boolean, default: false },
        },


        security: {
            loginAlerts: { type: Boolean, default: true },
            unknownDeviceAlerts: { type: Boolean, default: true },
            twoFactorEnabled: { type: Boolean, default: false },
        },


        vendorPreferences: {
            autoConfirmOrders: { type: Boolean, default: false },
            lowStockAlerts: { type: Boolean, default: true },
            orderNotificationSound: { type: Boolean, default: true },
        },



        locationPreferences: {
            autoDetectLocation: { type: Boolean, default: false },
            maxServiceRadiusKm: { type: Number, default: 10, min: 1, max: 100 },
        },


        system: {

            language: {
                type: String,
                enum: ["en", "hi", "mr", "gu", "bn", "ta"],
                default: "en",
                index: true,
            },
            theme: {
                type: String,
                enum: ["light", "dark", "system"],
                default: "system",
            },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.model("Settings", SettingsSchema);