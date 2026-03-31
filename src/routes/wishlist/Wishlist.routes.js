import { Router } from "express";
import {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    moveToCart,
    moveToWishlist,
} from "../../controllers/Wishlist/Wishlist.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";

const WishlistRouter = Router();

WishlistRouter.use(authenticate, authorize("user", "vendor", "homeowner", "Worker/Technician", "Other", "builder", "agent", "admin"));

WishlistRouter.get("/",                          getWishlist);
WishlistRouter.post("/add",                      addToWishlist);
WishlistRouter.delete("/clear",                  clearWishlist);
WishlistRouter.delete("/remove/:productId",      removeFromWishlist);
WishlistRouter.post("/move-to-cart/:productId",  moveToCart);


WishlistRouter.post("/move-from-cart/:productId", moveToWishlist);

export default WishlistRouter;
