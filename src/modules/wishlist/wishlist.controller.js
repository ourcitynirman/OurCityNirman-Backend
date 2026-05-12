import WishlistService from "./wishlist.service.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { productIdSchema } from "./wishlist.validation.js";

/**
 * @desc    Get all items in user's wishlist
 * @route   GET /api/v1/user/wishlist/
 * @access  Private
 */
export const getWishlist = asyncHandler(async (req, res) => {
    const wishlist = await WishlistService.getWishlist(req.user._id);

    if (wishlist.itemCount === 0 || !wishlist.items) {
        return res
            .status(200)
            .json(new ApiResponse(200, { items: [], itemCount: 0 }, "Wishlist is empty"));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, wishlist, "Wishlist fetched successfully"));
});

/**
 * @desc    Add a product to wishlist
 * @route   POST /api/v1/user/wishlist/add
 * @access  Private
 */
export const addToWishlist = asyncHandler(async (req, res, next) => {
    try {
        const { productId } = productIdSchema.parse(req.body);
        const { wishlist, alreadyExists } = await WishlistService.addToWishlist(req.user._id, productId);

        return res
            .status(200)
            .json(new ApiResponse(200, wishlist, alreadyExists ? "Product already in wishlist" : "Product added to wishlist"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Remove a specific product from wishlist
 * @route   DELETE /api/v1/user/wishlist/remove/:productId
 * @access  Private
 */
export const removeFromWishlist = asyncHandler(async (req, res, next) => {
    try {
        const { productId } = productIdSchema.parse(req.params);
        const wishlist = await WishlistService.removeFromWishlist(req.user._id, productId);

        return res
            .status(200)
            .json(new ApiResponse(200, wishlist, "Product removed from wishlist"));
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Remove all items from wishlist
 * @route   DELETE /api/v1/user/wishlist/clear
 * @access  Private
 */
export const clearWishlist = asyncHandler(async (req, res) => {
    const wishlist = await WishlistService.clearWishlist(req.user._id);
    return res
        .status(200)
        .json(new ApiResponse(200, wishlist, "Wishlist cleared"));
});

/**
 * @desc    Move an item from wishlist to shopping cart
 * @route   POST /api/v1/user/wishlist/move-to-cart/:productId
 * @access  Private
 */
export const moveToCart = asyncHandler(async (req, res, next) => {
    try {
        const { productId } = productIdSchema.parse(req.params);
        const result = await WishlistService.moveToCart(req.user._id, productId);

        return res.status(200).json(
            new ApiResponse(200, result, "Item moved to cart")
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});

/**
 * @desc    Move an item from cart to wishlist
 * @route   POST /api/v1/user/wishlist/move-from-cart/:productId
 * @access  Private
 */
export const moveToWishlist = asyncHandler(async (req, res, next) => {
    try {
        const { productId } = productIdSchema.parse(req.params);
        const { cart, wishlist, alreadyInWishlist } = await WishlistService.moveToWishlist(req.user._id, productId);

        return res.status(200).json(
            new ApiResponse(
                200,
                { cart, wishlist },
                alreadyInWishlist
                    ? "Item removed from cart (already in wishlist)"
                    : "Item moved to wishlist"
            )
        );
    } catch (err) {
        if (err.name === 'ZodError') {
            const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
            return next(new ApiError(400, 'Validation Error: ' + messages));
        }
        next(err);
    }
});