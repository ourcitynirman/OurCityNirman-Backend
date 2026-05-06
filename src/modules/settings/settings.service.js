import Settings from "./settings.model.js";
import { User } from "../auth/user.model.js";
import { ApiError } from "../../shared/utils/api.utils.js";

class SettingsService {
    static async getMySettings(user) {
        if (user.role !== "vendor") throw new ApiError(403, "Only vendors can access settings");

        let settings = await Settings.findOne({ userId: user._id });
        if (!settings) {
            settings = await Settings.create({ userId: user._id, role: "vendor" });
        }
        return settings;
    }

    static async updateMySettings(userId, userRole, data) {
        if (userRole !== "vendor") throw new ApiError(403, "Only vendors can update settings");

        const { currentPassword, newPassword, ...updates } = data;

        if (newPassword) {
            if (currentPassword === newPassword) throw new ApiError(400, "New password must be different");
            const user = await User.findById(userId).select("+password");
            if (!user) throw new ApiError(404, "User not found");

            const isMatch = await user.isPasswordCorrect(currentPassword);
            if (!isMatch) throw new ApiError(400, "Current password incorrect");

            user.password = newPassword;
            await user.save();
        }

        const settings = await Settings.findOneAndUpdate(
            { userId },
            { $set: this.flattenObject(updates) },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        );

        return settings;
    }

    static async getSettingsByUserId(userId) {
        const settings = await Settings.findOne({ userId });
        if (!settings) throw new ApiError(404, "Settings not found");
        return settings;
    }

    static async adminUpdateSettings(userId, updates) {
        const settings = await Settings.findOneAndUpdate(
            { userId },
            { $set: this.flattenObject(updates) },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        );
        return settings;
    }

    // Helper to convert nested object to dot notation for $set
    static flattenObject(obj, prefix = '') {
        const result = {};
        for (const key in obj) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                Object.assign(result, this.flattenObject(obj[key], newKey));
            } else {
                result[newKey] = obj[key];
            }
        }
        return result;
    }
}

export default SettingsService;
