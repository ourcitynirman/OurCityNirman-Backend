import Cart from './cart.model.js';
import Product from '../products/product.model.js';
import { ApiError } from '../../shared/utils/api.utils.js';

class CartService {
    static async normaliseCart(cart) {
        if (!cart) return { items: [], totalItems: 0, totalPrice: 0 };

        // Extract vendor IDs
        const vendorIds = (cart.items || [])
            .map((item) => item.product?.vendorId?.toString())
            .filter(Boolean);

        // Fetch shops for these vendors
        let shopMap = {};
        if (vendorIds.length > 0) {
            try {
                const Shop = (await import('../shop/shop.model.js')).default;
                const shops = await Shop.find({ vendor: { $in: vendorIds } }).lean();
                for (const shop of shops) {
                    shopMap[shop.vendor.toString()] = {
                        pincode: shop.address?.pincode || '',
                        state: shop.address?.state || '',
                        shopname: shop.shopname || '',
                    };
                }
            } catch (err) {
                console.error("Error fetching shops in normaliseCart:", err.message);
            }
        }

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

                const shopInfo = p.vendorId ? shopMap[p.vendorId.toString()] : null;

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
                    vendorId:      p.vendorId?.toString() ?? '',
                    shopPincode:   shopInfo?.pincode ?? '',
                    shopState:     shopInfo?.state ?? '',
                    shopName:      shopInfo?.shopname ?? '',
                };
            });

        return {
            items,
            totalItems:  cart.totalItems  ?? 0,
            totalPrice:  cart.totalPrice  ?? 0,
        };
    }

    static async getCart(userId) {
        const cart = await Cart.getOrCreate(userId);
        return await this.normaliseCart(cart);
    }

    static async addToCart(userId, productId, quantity) {
        const product = await Product.findById(productId);
        if (!product) throw new ApiError(404, 'Product not found');
        if (!product.isActive) throw new ApiError(400, 'Product is not available');
        if (!product.inStock || product.quantityAvailable < quantity) {
            throw new ApiError(400, `Only ${product.quantityAvailable} unit(s) in stock`);
        }

        const cart = await Cart.getOrCreate(userId);
        const updatedCart = await cart.addItem(productId, product.price, quantity);
        return await this.normaliseCart(updatedCart);
    }

    static async updateCartItem(userId, productId, quantity) {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) throw new ApiError(404, 'Cart not found');

        const updatedCart = await cart.updateItem(productId, quantity);
        if (!updatedCart) throw new ApiError(404, 'Item not found in cart');

        return await this.normaliseCart(updatedCart);
    }

    static async removeFromCart(userId, productId) {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) throw new ApiError(404, 'Cart not found');

        const exists = cart.items.some(
            (i) => (i.product?._id ?? i.product)?.toString() === productId
        );
        if (!exists) throw new ApiError(404, 'Item not found in cart');

        const updatedCart = await cart.removeItem(productId);
        return await this.normaliseCart(updatedCart);
    }

    static async clearCart(userId) {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) throw new ApiError(404, 'Cart not found');

        await cart.clearCart();
        return { items: [], totalItems: 0, totalPrice: 0 };
    }
}

export default CartService;
