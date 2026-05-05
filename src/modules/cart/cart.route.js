import { Router } from "express";
import {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
} from "./cart.controller.js";
import { moveToWishlist } from "../wishlist/wishlist.controller.js";
import { authenticate, authorize } from "../../shared/middlewares/auth.middleware.js";
import { ALL_ROLES } from "../../shared/constants/roles.js";

const CartRouter = Router();

CartRouter.use(authenticate, authorize(...ALL_ROLES));

/**
 * @desc    Get current user's shopping cart
 * @route   GET /api/v1/user/cart/
 * @access  Private
 */
CartRouter.get("/",                                getCart);

/**
 * @desc    Add a product to shopping cart
 * @route   POST /api/v1/user/cart/items
 * @access  Private
 */
CartRouter.post("/items",                          addToCart);

/**
 * @desc    Update quantity of a cart item
 * @route   PATCH /api/v1/user/cart/items/:productId
 * @access  Private
 */
CartRouter.patch("/items/:productId",              updateCartItem);

/**
 * @desc    Remove an item from shopping cart
 * @route   DELETE /api/v1/user/cart/items/:productId
 * @access  Private
 */
CartRouter.delete("/items/:productId",             removeFromCart);

/**
 * @desc    Remove all items from shopping cart
 * @route   DELETE /api/v1/user/cart/clear
 * @access  Private
 */
CartRouter.delete("/clear",                        clearCart);

/**
 * @desc    Move a cart item to user's wishlist
 * @route   POST /api/v1/user/cart/move-to-wishlist/:productId
 * @access  Private
 */
CartRouter.post("/move-to-wishlist/:productId",    moveToWishlist); 

export default CartRouter;
