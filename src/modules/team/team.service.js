import Team from "./team.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";
import { ApiError } from "../../shared/utils/api.utils.js";

class TeamService {
    static async getActiveMembers() {
        return await Team.getActiveMembers();
    }

    static async getAllMembers(query) {

        const { page, limit, isActive, sort } = query;
        const skip = (page - 1) * limit;
        const filter = {};
        if (isActive !== undefined) filter.isActive = isActive === "true";

        const sortOptions = sort.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort]: 1 };

        const [members, total] = await Promise.all([
            Team.find(filter).populate("createdBy", "fullName email").populate("updatedBy", "fullName email").sort(sortOptions).skip(skip).limit(limit),
            Team.countDocuments(filter),
        ]);

        return { members, total, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    static async getMemberById(id) {
        const member = await Team.findById(id).populate("createdBy", "fullName email").populate("updatedBy", "fullName email");
        if (!member) throw new ApiError(404, "Team member not found");
        return member;
    }

    static async createMember(data, files, user) {
        const { name, role, badge, linkedin, twitter, order, isActive, image: imageUrl } = data;
        let finalImageUrl = imageUrl;
        let imagePublicId = null;

        const imageLocalPath = files?.image?.[0]?.path;
        if (imageLocalPath) {
            const uploaded = await uploadOnCloudinary(imageLocalPath);
            if (!uploaded?.url) throw new ApiError(500, "Image upload failed");
            finalImageUrl = uploaded.url;
            imagePublicId = uploaded.public_id;
        }

        if (!finalImageUrl) throw new ApiError(400, "Image required");

        let memberOrder = order;
        if (memberOrder === undefined) {
            const lastMember = await Team.findOne().sort({ order: -1 });
            memberOrder = lastMember ? lastMember.order + 1 : 0;
        }

        return await Team.create({
            name, role, badge: badge || "Team", image: finalImageUrl, imagePublicId,
            linkedin: linkedin || "", twitter: twitter || "", order: memberOrder,
            isActive, createdBy: user._id, updatedBy: user._id
        });
    }

    static async updateMember(id, data, files, user) {
        const member = await Team.findById(id);
        if (!member) throw new ApiError(404, "Team member not found");

        const { name, role, badge, linkedin, twitter, order, isActive, image: imageUrl } = data;
        const imageLocalPath = files?.image?.[0]?.path;

        if (imageLocalPath) {
            if (member.imagePublicId) await deleteFromCloudinary(member.imagePublicId);
            const uploaded = await uploadOnCloudinary(imageLocalPath);
            if (!uploaded?.url) throw new ApiError(500, "Image upload failed");
            member.image = uploaded.url;
            member.imagePublicId = uploaded.public_id;
        } else if (imageUrl) {
            member.image = imageUrl;
        }

        if (name !== undefined) member.name = name;
        if (role !== undefined) member.role = role;
        if (badge !== undefined) member.badge = badge;
        if (linkedin !== undefined) member.linkedin = linkedin;
        if (twitter !== undefined) member.twitter = twitter;
        if (order !== undefined) member.order = order;
        if (isActive !== undefined) member.isActive = isActive;
        member.updatedBy = user._id;

        return await member.save();
    }

    static async toggleMemberStatus(id, user) {
        const member = await Team.findById(id);
        if (!member) throw new ApiError(404, "Team member not found");
        member.isActive = !member.isActive;
        member.updatedBy = user._id;
        return await member.save();
    }

    static async reorderMembers(members) {
        return await Team.reorder(members);
    }

    static async deleteMember(id, user) {
        const member = await Team.findById(id);
        if (!member) throw new ApiError(404, "Team member not found");
        member.isActive = false;
        member.updatedBy = user._id;
        return await member.save();
    }

    static async permanentDeleteMember(id) {
        const member = await Team.findById(id);
        if (!member) throw new ApiError(404, "Team member not found");
        if (member.imagePublicId) await deleteFromCloudinary(member.imagePublicId);
        return await Team.findByIdAndDelete(id);
    }

    static async getMemberStats() {
        const stats = await Team.aggregate([
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: 1 },
                                active: { $sum: { $cond: ["$isActive", 1, 0] } },
                                inactive: { $sum: { $cond: ["$isActive", 0, 1] } },
                            },
                        },
                    ],
                    recent: [
                        { $sort: { createdAt: -1 } },
                        { $limit: 5 },
                        { $project: { name: 1, isActive: 1, order: 1, createdAt: 1 } },
                    ],
                },
            },
        ]);

        const result = stats[0];
        return {
            summary: result.totals[0] || { total: 0, active: 0, inactive: 0 },
            recentMembers: result.recent,
        };
    }
}

export default TeamService;
