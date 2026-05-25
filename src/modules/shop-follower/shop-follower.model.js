import mongoose from "mongoose";

const shopFollowerSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        shop: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shop",
            required: true,
            index: true
        }
    },
    { timestamps: true }
);

shopFollowerSchema.index({ user: 1, shop: 1 }, { unique: true });

const ShopFollower = mongoose.model("ShopFollower", shopFollowerSchema);
export default ShopFollower;
