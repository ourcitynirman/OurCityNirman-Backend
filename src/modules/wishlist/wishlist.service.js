import Wishlist from "./wishlist.model.js";
import Product from "../products/product.model.js";
import Cart from "../cart/cart.model.js";
import CartService from "../cart/cart.service.js";
import { ApiError } from "../../shared/utils/api.utils.js";

const getProductId = (productRef) => {
    if (!productRef) return null;
    if (productRef._id) return productRef._id.toString(); 
    return productRef.toString();                          
};

class WishlistService {
    static async getWishlist(userId) {
        const wishlist = await Wishlist.findOne({ user: userId })
            .populate({
                path: "items.product",
                select: "name price originalPrice discount rating reviews images slug inStock quantityAvailable isActive brand category",
                populate: [
                    { path: "brand", select: "name" },
                    { path: "category", select: "name" }
                ]
            })
            .lean();

        if (!wishlist) {
            return { items: [], itemCount: 0 };
        }
        return wishlist;
    }

    static async addToWishlist(userId, productId) {
        const product = await Product.findById(productId).select(
            "name price images slug isActive"
        );
        if (!product) throw new ApiError(404, "Product not found");
        if (!product.isActive) throw new ApiError(400, "Product is not available");

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) wishlist = new Wishlist({ user: userId, items: [] });

        const alreadyExists = wishlist.items.some(
            (item) => getProductId(item.product) === productId.toString()
        );
        
        if (alreadyExists) {
            return { wishlist, alreadyExists: true };
        }

        wishlist.items.push({
            product: productId,
            productSnapshot: {
                name:  product.name,
                price: product.price,
                image: product.images?.[0] || null,
                slug:  product.slug,
            },
        });

        await wishlist.save();
        return { wishlist, alreadyExists: false };
    }

    static async removeFromWishlist(userId, productId) {
        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) throw new ApiError(404, "Wishlist not found");

        const before = wishlist.items.length;
        wishlist.items = wishlist.items.filter(
            (item) => getProductId(item.product) !== productId.toString()
        );
        if (wishlist.items.length === before)
            throw new ApiError(404, "Product not found in wishlist");

        await wishlist.save();
        return wishlist;
    }

    static async clearWishlist(userId) {
        const result = await Wishlist.findOneAndUpdate(
            { user: userId },
            { $set: { items: [] } },
            { returnDocument: 'after' }
        );
        return result || { items: [] };
    }

    static async moveToCart(userId, productId) {
        const pid = productId.toString();

        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) throw new ApiError(404, "Wishlist not found");

        const wishlistItem = wishlist.items.find(
            (item) => getProductId(item.product) === pid
        );
        if (!wishlistItem) throw new ApiError(404, "Product not found in wishlist");

        const product = await Product.findById(productId).select(
            "price inStock quantityAvailable isActive"
        );
        if (!product || !product.isActive)
            throw new ApiError(400, "Product is no longer available");
        if (!product.inStock || product.quantityAvailable <= 0)
            throw new ApiError(400, "Product is out of stock");

        const cart = await Cart.getOrCreate(userId);
        const updatedCart = await cart.addItem(productId, product.price, 1);

        wishlist.items = wishlist.items.filter(
            (item) => getProductId(item.product) !== pid
        );
        await wishlist.save();

        return {
            cart: await CartService.normaliseCart(updatedCart),
            wishlist,
        };
    }

    static async moveToWishlist(userId, productId) {
        const pid = productId.toString();

        const cart = await Cart.findOne({ user: userId });
        if (!cart) throw new ApiError(404, "Cart not found");

        const cartItem = cart.items.find(
            (item) => getProductId(item.product) === pid
        );
        if (!cartItem) throw new ApiError(404, "Product not found in cart");

        const product = await Product.findById(productId).select(
            "name price images slug isActive"
        );
        if (!product || !product.isActive)
            throw new ApiError(400, "Product is no longer available");

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) wishlist = new Wishlist({ user: userId, items: [] });

        const alreadyInWishlist = wishlist.items.some(
            (item) => getProductId(item.product) === pid
        );

        if (!alreadyInWishlist) {
            wishlist.items.push({
                product: productId,
                productSnapshot: {
                    name:  product.name,
                    price: product.price,
                    image: product.images?.[0] || null,
                    slug:  product.slug,
                },
            });
            await wishlist.save();
        }

        const updatedCart = await cart.removeItem(pid);

        return {
            cart: await CartService.normaliseCart(updatedCart),
            wishlist,
            alreadyInWishlist,
        };
    }
}

export default WishlistService;
