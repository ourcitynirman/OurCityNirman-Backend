import mongoose from "mongoose";

const homeSliderSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Slide title is required"],
            trim: true,
            minlength: [3, "Title must be at least 3 characters"],
            maxlength: [100, "Title cannot exceed 100 characters"],
        },
        subtitle: {
            type: String,
            trim: true,
            maxlength: [200, "Subtitle cannot exceed 200 characters"],
            default: "",
        },
        image: {
            type: String,
            required: [true, "Slide image is required"],
            trim: true,
        },
        imagePublicId: {
            type: String,
            default: null,
        },
        buttonText: {
            type: String,
            trim: true,
            maxlength: [50, "Button text cannot exceed 50 characters"],
            default: "Shop Now",
        },
        link: {
            type: String,
            trim: true,
            default: "/",
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
        duration: {
            type: Number,
            default: 5000,
            min: [1000, "Duration must be at least 1000ms"],
            max: [30000, "Duration cannot exceed 30000ms"],
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

homeSliderSchema.index({ isActive: 1, order: 1 });
homeSliderSchema.index({ createdAt: -1 });

homeSliderSchema.statics.getActiveSlides = function () {
    return this.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
};

homeSliderSchema.statics.getSlideStats = async function () {
    const [stats] = await this.aggregate([
        {
            $group: {
                _id: null,
                totalSlides: { $sum: 1 },
                activeSlides: { $sum: { $cond: ["$isActive", 1, 0] } },
                inactiveSlides: { $sum: { $cond: ["$isActive", 0, 1] } },
            },
        },
    ]);
    return stats || { totalSlides: 0, activeSlides: 0, inactiveSlides: 0 };
};

homeSliderSchema.statics.reorder = async function (slideOrders = []) {
    const ops = slideOrders.map(({ id, order }) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { order } },
        },
    }));
    return this.bulkWrite(ops);
};

homeSliderSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    delete obj.imagePublicId;
    return obj;
};

const HomeSlider = mongoose.model("HomeSlider", homeSliderSchema);

export default HomeSlider;