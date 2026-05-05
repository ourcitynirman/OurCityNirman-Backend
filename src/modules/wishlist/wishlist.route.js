import { Router } from "express";
import {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    moveToCart,
    moveToWishlist,
} from "./wishlist.controller.js";
import { authenticate, authorize } from "../../shared/middlewares/auth.middleware.js";
import { ALL_ROLES } from "../../shared/constants/roles.js";

const WishlistRouter = Router();

WishlistRouter.use(authenticate, authorize(...ALL_ROLES));

/**
 * @desc    Get all items in user's wishlist
 * @route   GET /api/v1/user/wishlist/
 * @access  Private
 */
WishlistRouter.get("/",                          getWishlist);

/**
 * @desc    Add a product to wishlist
 * @route   POST /api/v1/user/wishlist/add
 * @access  Private
 */
WishlistRouter.post("/add",                      addToWishlist);

/**
 * @desc    Remove all items from wishlist
 * @route   DELETE /api/v1/user/wishlist/clear
 * @access  Private
 */
WishlistRouter.delete("/clear",                  clearWishlist);

/**
 * @desc    Remove a specific product from wishlist
 * @route   DELETE /api/v1/user/wishlist/remove/:productId
 * @access  Private
 */
WishlistRouter.delete("/remove/:productId",      removeFromWishlist);

/**
 * @desc    Move an item from wishlist to shopping cart
 * @route   POST /api/v1/user/wishlist/move-to-cart/:productId
 * @access  Private
 */
WishlistRouter.post("/move-to-cart/:productId",  moveToCart);

/**
 * @desc    Move an item from cart to wishlist
 * @route   POST /api/v1/user/wishlist/move-from-cart/:productId
 * @access  Private
 */
WishlistRouter.post("/move-from-cart/:productId", moveToWishlist);

export default WishlistRouter;
