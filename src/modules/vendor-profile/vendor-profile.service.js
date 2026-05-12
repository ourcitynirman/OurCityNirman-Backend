import VendorProfile from "./vendor-profile.model.js";
import { ApiError } from "../../shared/utils/api.utils.js";

class VendorProfileService {
    static async createOrUpdateProfile(userId, profileData) {
        let profile = await VendorProfile.findOne({ user: userId });

        if (profile) {
            // Update existing profile
            Object.assign(profile, profileData);
            // If updating, we might want to reset verification status if critical fields changed
            // profile.verificationStatus = "pending"; 
            await profile.save();
        } else {
            // Create new profile
            profile = await VendorProfile.create({
                user: userId,
                ...profileData,
            });
        }

        return profile;
    }

    static async getProfile(userId) {
        const profile = await VendorProfile.findOne({ user: userId });
        if (!profile) {
            throw new ApiError(404, "Vendor profile not found");
        }
        return profile;
    }

    static async adminUpdateStatus(profileId, status, reason) {
        const profile = await VendorProfile.findById(profileId);
        if (!profile) throw new ApiError(404, "Profile not found");

        profile.verificationStatus = status;
        profile.isVerified = status === "approved";
        if (reason) profile.notes = (profile.notes || "") + `\nAdmin Note: ${reason}`;
        
        await profile.save();
        return profile;
    }

    static async adminGetAllProfiles(query = {}) {
        const { status, page = 1, limit = 10 } = query;
        const filter = status ? { verificationStatus: status } : {};
        
        const profiles = await VendorProfile.find(filter)
            .populate("user", "fullName email phone")
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 });
            
        const total = await VendorProfile.countDocuments(filter);
        
        return {
            profiles,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        };
    }
}

export default VendorProfileService;
