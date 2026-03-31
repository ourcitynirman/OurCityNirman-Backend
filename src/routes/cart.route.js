import { Router } from "express";
import {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
} from "../controllers/cart/cart.controller.js";
import { moveToWishlist } from "../controllers/Wishlist/Wishlist.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const CartRouter = Router();

CartRouter.use(authenticate, authorize("user", "vendor", "homeowner", "Worker/Technician", "Other", "builder", "agent", "admin"));

CartRouter.get("/",                                getCart);
CartRouter.post("/items",                          addToCart);
CartRouter.patch("/items/:productId",              updateCartItem);
CartRouter.delete("/items/:productId",             removeFromCart);
CartRouter.delete("/clear",                        clearCart);
CartRouter.post("/move-to-wishlist/:productId",    moveToWishlist); 

export default CartRouter;
