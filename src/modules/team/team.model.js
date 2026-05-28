import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Member name is required"],
            trim: true,
            minlength: [2, "Name must be at least 2 characters"],
            maxlength: [100, "Name cannot exceed 100 characters"],
        },
        role: {
            type: String,
            required: [true, "Member role is required"],
            trim: true,
            maxlength: [100, "Role cannot exceed 100 characters"],
        },
        image: {
            type: String,
            required: [true, "Member image is required"],
            trim: true,
        },
        imagePublicId: {
            type: String,
            default: null,
        },
        badge: {
            type: String,
            trim: true,
            maxlength: [50, "Badge cannot exceed 50 characters"],
            default: "Team",
        },
        linkedin: {
            type: String,
            trim: true,
            default: "",
        },
        twitter: {
            type: String,
            trim: true,
            default: "",
        },
        order: {
            type: Number,
            default: 0,
            min: [0, "Order cannot be negative"],
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

teamSchema.index({ isActive: 1, order: 1 });
teamSchema.index({ createdAt: -1 });

teamSchema.statics.getActiveMembers = function () {
    return this.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
};

teamSchema.statics.getMemberStats = async function () {
    const [stats] = await this.aggregate([
        {
            $group: {
                _id: null,
                totalMembers: { $sum: 1 },
                activeMembers: { $sum: { $cond: ["$isActive", 1, 0] } },
                inactiveMembers: { $sum: { $cond: ["$isActive", 0, 1] } },
            },
        },
    ]);
    return stats || { totalMembers: 0, activeMembers: 0, inactiveMembers: 0 };
};

teamSchema.statics.reorder = async function (memberOrders = []) {
    const ops = memberOrders.map(({ id, order }) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { order } },
        },
    }));
    return this.bulkWrite(ops);
};

teamSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    delete obj.imagePublicId;
    return obj;
};

const Team = mongoose.models.Team || mongoose.model("Team", teamSchema);

export default Team;
