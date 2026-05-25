import { ApiResponse, asyncHandler } from "../../shared/utils/api.utils.js";
import ShopFollower from "./shop-follower.model.js";
import Shop from "../shop/shop.model.js";

// Toggle follow/unfollow
export const toggleFollow = asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const userId = req.user._id;

    const existingFollow = await ShopFollower.findOne({ user: userId, shop: shopId });

    if (existingFollow) {
        // Unfollow
        await ShopFollower.findByIdAndDelete(existingFollow._id);
        // Optional: you could track a follower count on the Shop model here
        return res.status(200).json(new ApiResponse(200, { isFollowing: false }, "Unfollowed shop successfully"));
    } else {
        // Follow
        await ShopFollower.create({ user: userId, shop: shopId });
        return res.status(201).json(new ApiResponse(201, { isFollowing: true }, "Followed shop successfully"));
    }
});

// Check if user follows a shop
export const checkFollowStatus = asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const userId = req.user._id;

    const existingFollow = await ShopFollower.findOne({ user: userId, shop: shopId });

    return res.status(200).json(new ApiResponse(200, { isFollowing: !!existingFollow }, "Follow status retrieved"));
});

// Get user's followed shops
export const getFollowedShops = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const followedShops = await ShopFollower.find({ user: userId })
        .populate({
            path: 'shop',
            populate: [
                { path: 'vendor', select: 'fullName name' },
                { path: 'category', select: 'name' }
            ]
        })
        .sort({ createdAt: -1 });

    const shops = followedShops.map(f => f.shop);

    return res.status(200).json(new ApiResponse(200, { shops }, "Followed shops retrieved"));
});
