import Wishlist from "./wishlist.model.js";
import Product from "../products/product.model.js";
import Cart from "../cart/cart.model.js";
import { validateObjectId } from "../../shared/utils/validation.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";

const getProductId = (productRef) => {
    if (!productRef) return null;
    if (productRef._id) return productRef._id.toString(); 
    return productRef.toString();                          
};

const normaliseCart = (cart) => {
    if (!cart) return { items: [], totalItems: 0, totalPrice: 0 };

    const items = (cart.items || [])
        .filter((item) => item.product && item.product.isActive !== false)
        .map((item) => {
            const p = item.product;
            const stockStatus =
                !p.inStock || p.quantityAvailable <= 0 ? "out_of_stock"
                : p.quantityAvailable <= 5             ? "low_stock"
                                                       : "in_stock";
            return {
                id:            p._id?.toString(),
                productId:     p._id?.toString(),
                name:          p.name          ?? "",
                brand:         p.brand         ?? "",
                category:      p.category      ?? "",
                image:         p.images?.[0]   ?? "",
                images:        p.images        ?? [],
                price:         p.price         ?? item.price ?? 0,
                originalPrice: p.originalPrice ?? p.price ?? item.price ?? 0,
                discount:      p.discount      ?? 0,
                rating:        p.rating        ?? 0,
                ratingCount:   p.reviews       ?? 0,
                stock:         stockStatus,
                qty:           item.quantity   ?? 1,
            };
        });

    return {
        items,
        totalItems: cart.totalItems ?? 0,
        totalPrice: cart.totalPrice ?? 0,
    };
};

/**
 * @desc    Get all items in user's wishlist
 * @route   GET /api/v1/user/wishlist/
 * @access  Private
 */
const getWishlist = asyncHandler(async (req, res) => {
    const wishlist = await Wishlist.findOne({ user: req.user._id })
        .populate({
            path: "items.product",
            select: "name price originalPrice discount rating reviews images slug inStock quantityAvailable isActive brand category",
        })
        .lean();

    if (!wishlist) {
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
const addToWishlist = asyncHandler(async (req, res) => {
    const { productId } = req.body || {};
    const validProductId = validateObjectId(productId, "productId");

    const product = await Product.findById(validProductId).select(
        "name price images slug isActive"
    );
    if (!product)        throw new ApiError(404, "Product not found");
    if (!product.isActive) throw new ApiError(400, "Product is not available");

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) wishlist = new Wishlist({ user: req.user._id, items: [] });

    const alreadyExists = wishlist.items.some(
        (item) => getProductId(item.product) === validProductId.toString()
    );
    if (alreadyExists) {
        return res
            .status(200)
            .json(new ApiResponse(200, wishlist, "Product already in wishlist"));
    }

    wishlist.items.push({
        product: validProductId,
        productSnapshot: {
            name:  product.name,
            price: product.price,
            image: product.images?.[0] || null,
            slug:  product.slug,
        },
    });

    await wishlist.save();

    return res
        .status(200)
        .json(new ApiResponse(200, wishlist, "Product added to wishlist"));
});

/**
 * @desc    Remove a specific product from wishlist
 * @route   DELETE /api/v1/user/wishlist/remove/:productId
 * @access  Private
 */
const removeFromWishlist = asyncHandler(async (req, res) => {
    const validProductId = validateObjectId(req.params.productId, "productId");

    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) throw new ApiError(404, "Wishlist not found");

    const before = wishlist.items.length;
    wishlist.items = wishlist.items.filter(
        (item) => getProductId(item.product) !== validProductId.toString()
    );
    if (wishlist.items.length === before)
        throw new ApiError(404, "Product not found in wishlist");

    await wishlist.save();

    return res
        .status(200)
        .json(new ApiResponse(200, wishlist, "Product removed from wishlist"));
});

/**
 * @desc    Remove all items from wishlist
 * @route   DELETE /api/v1/user/wishlist/clear
 * @access  Private
 */
const clearWishlist = asyncHandler(async (req, res) => {
    const result = await Wishlist.findOneAndUpdate(
        { user: req.user._id },
        { $set: { items: [] } },
        { returnDocument: 'after' }
    );
    return res
        .status(200)
        .json(new ApiResponse(200, result || { items: [] }, "Wishlist cleared"));
});

/**
 * @desc    Move an item from wishlist to shopping cart
 * @route   POST /api/v1/user/wishlist/move-to-cart/:productId
 * @access  Private
 */
const moveToCart = asyncHandler(async (req, res) => {
    const validProductId = validateObjectId(req.params.productId, "productId");
    const pid = validProductId.toString();

    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) throw new ApiError(404, "Wishlist not found");

    const wishlistItem = wishlist.items.find(
        (item) => getProductId(item.product) === pid
    );
    if (!wishlistItem) throw new ApiError(404, "Product not found in wishlist");

    const product = await Product.findById(validProductId).select(
        "price inStock quantityAvailable isActive"
    );
    if (!product || !product.isActive)
        throw new ApiError(400, "Product is no longer available");
    if (!product.inStock || product.quantityAvailable <= 0)
        throw new ApiError(400, "Product is out of stock");

    const cart = await Cart.getOrCreate(req.user._id);
    const updatedCart = await cart.addItem(validProductId, product.price, 1);

    wishlist.items = wishlist.items.filter(
        (item) => getProductId(item.product) !== pid
    );
    await wishlist.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                cart:     normaliseCart(updatedCart),
                wishlist,
            },
            "Item moved to cart"
        )
    );
});

/**
 * @desc    Move an item from cart to wishlist
 * @route   POST /api/v1/user/wishlist/move-from-cart/:productId
 * @access  Private
 */
const moveToWishlist = asyncHandler(async (req, res) => {
    const validProductId = validateObjectId(req.params.productId, "productId");
    const pid = validProductId.toString();

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) throw new ApiError(404, "Cart not found");

    const cartItem = cart.items.find(
        (item) => getProductId(item.product) === pid
    );
    if (!cartItem) throw new ApiError(404, "Product not found in cart");

    const product = await Product.findById(validProductId).select(
        "name price images slug isActive"
    );
    if (!product || !product.isActive)
        throw new ApiError(400, "Product is no longer available");

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) wishlist = new Wishlist({ user: req.user._id, items: [] });

    const alreadyInWishlist = wishlist.items.some(
        (item) => getProductId(item.product) === pid
    );

    if (!alreadyInWishlist) {
        wishlist.items.push({
            product: validProductId,
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

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                cart:     normaliseCart(updatedCart),
                wishlist,
            },
            alreadyInWishlist
                ? "Item removed from cart (already in wishlist)"
                : "Item moved to wishlist"
        )
    );
});

export {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    moveToCart,
    moveToWishlist, 
};