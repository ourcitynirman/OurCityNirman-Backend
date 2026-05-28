/**
 * @file        routes.js
 * @desc        Centralized API route registry — industry-standard separation of concerns.
 *              All route modules are imported here and mounted on the Express app instance
 *              under the versioned /api/v1 namespace.
 *
 * @convention  Group routes by domain (Auth → User → Vendor → Admin → Shared).
 *              Every route prefix must be documented with @prefix and @access.
 */

// ── Route Modules ─────────────────────────────────────────────────────────────
import authRouter         from './modules/auth/auth.route.js';
import productRouter      from './modules/products/product.route.js';
import brandRouter        from './modules/brand/brand.route.js';
import hsnRouter          from './modules/hsn/hsn.route.js';
import categoryRouter     from './modules/category/category.route.js';
import searchRouter       from './modules/search/search.route.js';
import inventoryRouter    from './modules/inventory/inventory.route.js';

import addressRouter      from './modules/address/address.route.js';
import cartRouter         from './modules/cart/cart.route.js';
import wishlistRouter     from './modules/wishlist/wishlist.route.js';
import orderRouter        from './modules/orders/order.route.js';
import reviewRouter       from './modules/review/review.route.js';
import invoiceRouter      from './modules/invoice/invoice.route.js';
import refundRouter       from './modules/refund/refund.route.js';
import paymentRouter      from './modules/payment/payment.route.js';

import { ShopRouter, VendorRouter, AdminShopRouter } from './modules/shop/shop.route.js';
import shopReviewRouter   from './modules/shop-review/shop-review.route.js';
import vendorProfileRouter from './modules/vendor-profile/vendor-profile.route.js';
import adminRouter        from './modules/admin/admin.route.js';
import sliderRouter       from './modules/homeslider/homeslider.route.js';
import settingsRouter     from './modules/settings/settings.route.js';
import shopFollowerRouter from './modules/shop-follower/shop-follower.route.js';
import teamRouter         from './modules/team/team.route.js';

// ── Route Registry ────────────────────────────────────────────────────────────
/**
 * @param {import('express').Application} app
 */
export function registerRoutes(app) {

    // ── Health Check ──────────────────────────────────────────────────────────
    /**
     * @prefix  GET /api/v1/health
     * @access  Public
     * @desc    Quick ping to verify the server is running
     */
    app.get('/api/v1/health', (_req, res) => {
        res.status(200).json({
            success: true,
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
        });
    });

    // ── Auth ──────────────────────────────────────────────────────────────────
    /**
     * @prefix  /api/v1/auth
     * @access  Public + Private
     * @desc    Registration, OTP verification, login, logout, token refresh,
     *          forgot/reset password, profile update
     */
    app.use('/api/v1/auth', authRouter);

    // ── Catalogue (Public) ────────────────────────────────────────────────────
    /**
     * @prefix  /api/v1/products
     * @access  Public (read) | Private/Vendor (write)
     * @desc    Product listing, detail, filtering, vendor CRUD
     */
    app.use('/api/v1/products', productRouter);

    /**
     * @prefix  /api/v1/brands
     * @access  Public (read) | Private/Admin (write)
     * @desc    Brand management and listing
     */
    app.use('/api/v1/brands', brandRouter);

    /**
     * @prefix  /api/v1/categories
     * @access  Public (read) | Private/Admin (write)
     * @desc    Hierarchical category tree management
     */
    app.use('/api/v1/categories', categoryRouter);

    /**
     * @prefix  /api/v1/hsn
     * @access  Public (read) | Private/Admin (write)
     * @desc    HSN code lookup for GST compliance
     */
    app.use('/api/v1/hsn', hsnRouter);

    /**
     * @prefix  /api/v1/search
     * @access  Public
     * @desc    Full-text product search, suggestions, recently viewed, compare
     */
    app.use('/api/v1/search', searchRouter);

    /**
     * @prefix  /api/v1/inventory
     * @access  Private (Vendor/Admin)
     * @desc    Stock levels, low-stock alerts, inventory updates
     */
    app.use('/api/v1/inventory', inventoryRouter);

    // ── User (Authenticated) ──────────────────────────────────────────────────
    /**
     * @prefix  /api/v1/user/address
     * @access  Private (All roles)
     * @desc    CRUD for saved delivery addresses
     */
    app.use('/api/v1/user/address', addressRouter);

    /**
     * @prefix  /api/v1/user/cart
     * @access  Private (All roles)
     * @desc    Cart operations — add, update, remove, clear, move-to-wishlist
     */
    app.use('/api/v1/user/cart', cartRouter);

    /**
     * @prefix  /api/v1/user/wishlist
     * @access  Private (All roles)
     * @desc    Wishlist — add, remove, clear, move-to-cart
     */
    app.use('/api/v1/user/wishlist', wishlistRouter);

    /**
     * @prefix  /api/v1/orders
     * @access  Private (All roles for own orders | Vendor for their items | Admin for all)
     * @desc    Order placement, status tracking, cancellation, Razorpay payment
     */
    app.use('/api/v1/orders', orderRouter);

    /**
     * @prefix  /api/v1/reviews
     * @access  Public (read) | Private (write/manage)
     * @desc    Product reviews — add, update, delete, mark helpful, vendor response
     */
    app.use('/api/v1/reviews', reviewRouter);

    app.use('/api/v1/invoice', invoiceRouter);

    /**
     * @prefix  /api/v1/refunds
     * @access  Private (Admin for processing | User/Admin for details)
     * @desc    Order refund processing via Razorpay and record retrieval
     */
    app.use('/api/v1/refunds', refundRouter);

    /**
     * @prefix  /api/v1/payments
     * @access  Private (All roles)
     * @desc    Payment gateway operations (Razorpay creation, verification)
     */
    app.use('/api/v1/payments', paymentRouter);

    // ── Vendor & Shop (Unified Domain) ────────────────────────────────────────
    /**
     * @prefix  /api/v1/vendor
     * @access  Private (Vendor — verified)
     * @desc    Vendor dashboard stats, inventory report, order management, shop profile
     */
    app.use('/api/v1/vendor', VendorRouter);

    /**
     * @prefix  /api/v1/shop
     * @access  Public (read) | Private/Vendor (write) | Private/Admin (moderate)
     * @desc    Shop creation, profile update, verification, reviews, and admin management
     */
    app.use('/api/v1/shop', ShopRouter);
    app.use('/api/v1/shop/admin', AdminShopRouter);

    /**
     * @prefix  /api/v1/shop-reviews
     * @access  Public (read) | Private (write)
     * @desc    Customer reviews for vendor shops
     */
    app.use('/api/v1/shop-reviews', shopReviewRouter);
    app.use('/api/v1/shop-follower', shopFollowerRouter);

    /**
     * @prefix  /api/v1/vendor-profile
     * @access  Private (Vendor/Admin)
     * @desc    Professional vendor profile, KYC, and bank details
     */
    app.use('/api/v1/vendor-profile', vendorProfileRouter);



    // ── Admin ─────────────────────────────────────────────────────────────────
    /**
     * @prefix  /api/v1/admin
     * @access  Private (Admin only)
     * @desc    User/Vendor management, product moderation, order overrides,
     *          dashboard stats, financial reports
     */
    app.use('/api/v1/admin', adminRouter);

    /**
     * @prefix  /api/v1/slider
     * @access  Public (read) | Private/Admin (write)
     * @desc    Homepage slider / banner management
     */
    app.use('/api/v1/slider', sliderRouter);

    /**
     * @prefix  /api/v1/team
     * @access  Public (read) | Private/Admin (write)
     * @desc    Team member management
     */
    app.use('/api/v1/team', teamRouter);

    /**
     * @prefix  /api/v1/settings
     * @access  Private (Vendor — own settings | Admin — any user's settings)
     * @desc    Account preferences and notification settings
     */
    app.use('/api/v1/settings', settingsRouter);
}
