import CartService from './cart.service.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { asyncHandler } from '../../shared/utils/api.utils.js';
import { addToCartSchema, updateCartItemSchema, paramsProductIdSchema } from './cart.validation.js';

/**
 * @desc    Get current user's shopping cart
 * @route   GET /api/v1/user/cart/
 * @access  Private
 */
export const getCart = asyncHandler(async (req, res, next) => {
    const cartData = await CartService.getCart(req.user._id);
    res.status(200).json({
        success: true,
        data: { cart: cartData },
    });
});

/**
 * @desc    Add a product to shopping cart
 * @route   POST /api/v1/user/cart/items
 * @access  Private
 */
export const addToCart = asyncHandler(async (req, res, next) => {
    try {
        const { productId, quantity } = addToCartSchema.parse(req.body);
        const cartData = await CartService.addToCart(req.user._id, productId, quantity);

        res.status(200).json({
            success: true,
            message: 'Item added to cart',
            data: { cart: cartData },
        });
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Update quantity of a cart item
 * @route   PATCH /api/v1/user/cart/items/:productId
 * @access  Private
 */
export const updateCartItem = asyncHandler(async (req, res, next) => {
    try {
        const { productId } = paramsProductIdSchema.parse(req.params);
        const { quantity } = updateCartItemSchema.parse(req.body);

        const cartData = await CartService.updateCartItem(req.user._id, productId, quantity);

        res.status(200).json({
            success: true,
            message: 'Cart updated',
            data: { cart: cartData },
        });
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Remove an item from shopping cart
 * @route   DELETE /api/v1/user/cart/items/:productId
 * @access  Private
 */
export const removeFromCart = asyncHandler(async (req, res, next) => {
    try {
        const { productId } = paramsProductIdSchema.parse(req.params);
        const cartData = await CartService.removeFromCart(req.user._id, productId);

        res.status(200).json({
            success: true,
            message: 'Item removed from cart',
            data: { cart: cartData },
        });
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
});

/**
 * @desc    Remove all items from shopping cart
 * @route   DELETE /api/v1/user/cart/clear
 * @access  Private
 */
export const clearCart = asyncHandler(async (req, res, next) => {
    const cartData = await CartService.clearCart(req.user._id);

    res.status(200).json({
        success: true,
        message: 'Cart cleared',
        data: { cart: cartData },
    });
});