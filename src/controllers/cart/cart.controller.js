import Cart from '../../models/cart.model.js';
import Product from '../../models/Product.model.js';
import ApiError from '../../utils/ApiError.js';
import asyncHandler from '../../utils/asyncHandler.js';

const normaliseCart = (cart) => {
    if (!cart) return { items: [], totalItems: 0, totalPrice: 0 };

    const items = (cart.items || [])
        .filter((item) => item.product && item.product.isActive !== false)
        .map((item) => {
            const p = item.product;
            const stockStatus =
                !p.inStock || p.quantityAvailable <= 0
                    ? 'out_of_stock'
                    : p.quantityAvailable <= 5
                    ? 'low_stock'
                    : 'in_stock';

            return {
                id:            p._id?.toString(),
                productId:     p._id?.toString(),
                name:          p.name          ?? '',
                brand:         p.brand         ?? '',
                category:      p.category      ?? '',
                image:         p.images?.[0]   ?? '',
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
        totalItems:  cart.totalItems  ?? 0,
        totalPrice:  cart.totalPrice  ?? 0,
    };
};

export const getCart = asyncHandler(async (req, res, next) => {
    const cart = await Cart.getOrCreate(req.user._id);
    res.status(200).json({
        success: true,
        data: { cart: normaliseCart(cart) },
    });
});

export const addToCart = asyncHandler(async (req, res, next) => {
    const { productId, quantity = 1 } = req.body;

    if (!productId)
        return next(new ApiError(400, 'productId is required'));
    if (!Number.isInteger(quantity) || quantity < 1)
        return next(new ApiError(400, 'quantity must be a positive integer'));
    if (quantity > 100)
        return next(new ApiError(400, 'quantity cannot exceed 100'));

    const product = await Product.findById(productId);
    if (!product)
        return next(new ApiError(404, 'Product not found'));
    if (!product.isActive)
        return next(new ApiError(400, 'Product is not available'));
    if (!product.inStock || product.quantityAvailable < quantity)
        return next(new ApiError(400, `Only ${product.quantityAvailable} unit(s) in stock`));

    const cart = await Cart.getOrCreate(req.user._id);

   
    const updatedCart = await cart.addItem(productId, product.price, quantity);

    res.status(200).json({
        success: true,
        message: 'Item added to cart',
        data: { cart: normaliseCart(updatedCart) },
    });
});

export const updateCartItem = asyncHandler(async (req, res, next) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!Number.isInteger(quantity) || quantity < 1)
        return next(new ApiError(400, 'quantity must be a positive integer'));
    if (quantity > 100)
        return next(new ApiError(400, 'quantity cannot exceed 100'));

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return next(new ApiError(404, 'Cart not found'));

    const updatedCart = await cart.updateItem(productId, quantity);
    if (!updatedCart) return next(new ApiError(404, 'Item not found in cart'));

    res.status(200).json({
        success: true,
        message: 'Cart updated',
        data: { cart: normaliseCart(updatedCart) },
    });
});

export const removeFromCart = asyncHandler(async (req, res, next) => {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return next(new ApiError(404, 'Cart not found'));

    const exists = cart.items.some(
        (i) => (i.product?._id ?? i.product)?.toString() === productId
    );
    if (!exists) return next(new ApiError(404, 'Item not found in cart'));

    const updatedCart = await cart.removeItem(productId);

    res.status(200).json({
        success: true,
        message: 'Item removed from cart',
        data: { cart: normaliseCart(updatedCart) },
    });
});

export const clearCart = asyncHandler(async (req, res, next) => {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return next(new ApiError(404, 'Cart not found'));

    await cart.clearCart();

    res.status(200).json({
        success: true,
        message: 'Cart cleared',
        data: { cart: { items: [], totalItems: 0, totalPrice: 0 } },
    });
});