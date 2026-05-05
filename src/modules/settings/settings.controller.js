import Settings from "./settings.model.js";
import { User }     from "../auth/user.model.js";
import ApiError from "../../shared/utils/ApiError.js";


const VENDOR_ALLOWED_FIELDS = [
    "notifications.orderUpdates",
    "notifications.promotions",
    "notifications.email",
    "notifications.push",
    "notifications.sms",
    "privacy.profileVisibility",
    "privacy.showPhone",
    "privacy.showEmail",
    "security.loginAlerts",
    "security.unknownDeviceAlerts",
    "security.twoFactorEnabled",
    "vendorPreferences.autoConfirmOrders",
    "vendorPreferences.lowStockAlerts",
    "vendorPreferences.orderNotificationSound",
    "locationPreferences.autoDetectLocation",
    "locationPreferences.maxServiceRadiusKm",
    "system.language",
    "system.theme",
];

const ADMIN_ALLOWED_FIELDS = [
    ...VENDOR_ALLOWED_FIELDS,
    "role",
];


function pickAllowedFields(body, allowedKeys) {
    const result = {};
    for (const key of allowedKeys) {
        const parts = key.split(".");
        let val = body;
        for (const part of parts) {
            val = val?.[part];
        }
        if (val !== undefined) {
            result[key] = val;
        }
    }
    return result;
}

export const getMySettings = async (req, res, next) => {
    try {
      
        if (req.user.role !== "vendor") {
            return next(new ApiError(403, "Only vendors can access settings"));
        }

        const userId = req.user._id;
        let settings = await Settings.findOne({ userId });

       
        if (!settings) {
            settings = await Settings.create({
                userId,
                role: "vendor",
            });
        }

        res.status(200).json({
            success: true,
            data: settings,
        });
    } catch (err) {
        next(err);
    }
};


export const updateMySettings = async (req, res, next) => {
    try {
        if (req.user.role !== "vendor") {
            return next(new ApiError(403, "Only vendors can update settings"));
        }

        const userId = req.user._id;
        const { currentPassword, newPassword, ...bodyUpdates } = req.body;

        //Password Change 
        if (newPassword) {
            if (!currentPassword) {
                return next(new ApiError(400, "Current password is required"));
            }

           
            if (newPassword.length < 4) {
                return next(new ApiError(400, "New password must be at least  4 characters"));
            }

            if (currentPassword === newPassword) {
                return next(new ApiError(400, "New password must be different from current password"));
            }

            const user = await User.findById(userId).select("+password");
            if (!user) return next(new ApiError(404, "User not found"));

            const isMatch = await user.isPasswordCorrect(currentPassword);
            if (!isMatch) {
                return next(new ApiError(400, "Current password is incorrect"));
            }

           
            user.password = newPassword;
            await user.save();

  
            if (!Object.keys(bodyUpdates).length) {
                return res.status(200).json({
                    success: true,
                    message: "Password updated successfully",
                });
            }
        }

      
        const safeUpdates = pickAllowedFields(bodyUpdates, VENDOR_ALLOWED_FIELDS);

        if (!Object.keys(safeUpdates).length && !newPassword) {
            return next(new ApiError(400, "No valid fields to update"));
        }

        const settings = await Settings.findOneAndUpdate(
            { userId },
            { $set: safeUpdates },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            message: "Settings updated successfully",
            data: settings,
        });
    } catch (err) {
        next(err);
    }
};


export const getSettingsByUserId = async (req, res, next) => {
    try {
        const settings = await Settings.findOne({ userId: req.params.userId });
        if (!settings) {
            return next(new ApiError(404, "Settings not found for this user"));
        }
        res.status(200).json({
            success: true,
            data: settings,
        });
    } catch (err) {
        next(err);
    }
};


export const adminUpdateSettings = async (req, res, next) => {
    try {
        const safeUpdates = pickAllowedFields(req.body, ADMIN_ALLOWED_FIELDS);

        if (!Object.keys(safeUpdates).length) {
            return next(new ApiError(400, "No valid fields to update"));
        }

        const settings = await Settings.findOneAndUpdate(
            { userId: req.params.userId },
            { $set: safeUpdates },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            message: "Settings updated by admin",
            data: settings,
        });
    } catch (err) {
        next(err);
    }
};