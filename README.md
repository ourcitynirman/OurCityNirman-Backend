# OurCityNirman API Documentation

यह Document Frontend Developers के लिए है। इसमें सभी Modules के API Endpoints, उनका काम (Description), Route Path, और Access Level (कौन इसे इस्तेमाल कर सकता है) की जानकारी दी गई है।

---

## 📍 Address Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/user/address/` | Get all saved addresses for the current user | Private |
| `POST` | `/api/v1/user/address/add` | Add a new address to user profile | Private |
| `POST` | `/api/v1/user/address/bulk` | Add multiple addresses in bulk | Private |
| `GET` | `/api/v1/user/address/:id` | Get details of a specific address by ID | Private |
| `PUT` | `/api/v1/user/address/:id` | Update an existing address | Private |
| `DELETE` | `/api/v1/user/address/:id` | Delete an address | Private |
| `PATCH` | `/api/v1/user/address/:id/set-default` | Set an address as default | Private |

---

## 👑 Admin Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/admin/stats` | Get administrative dashboard statistics | Private (Admin) |
| `GET` | `/api/v1/admin/reports/finance` | Get detailed platform financial performance reports | Private (Admin) |
| `GET` | `/api/v1/admin/users` | Get list of all users with filters | Private (Admin) |
| `GET` | `/api/v1/admin/users/:id` | Get detailed user profile by ID | Private (Admin) |
| `PATCH` | `/api/v1/admin/users/:id/block` | Block or unblock a user account | Private (Admin) |
| `DELETE` | `/api/v1/admin/users/:id` | Permanently delete a user account | Private (Admin) |
| `GET` | `/api/v1/admin/vendors` | Get list of all registered vendors | Private (Admin) |
| `PATCH` | `/api/v1/admin/vendors/:id/verify` | Verify a vendor's account status | Private (Admin) |
| `PATCH` | `/api/v1/admin/vendors/:id/block` | Block or unblock a vendor account | Private (Admin) |
| `GET` | `/api/v1/admin/products` | Get list of all products (for moderation) | Private (Admin) |
| `PATCH` | `/api/v1/admin/products/:id/approve` | Approve a pending product listing | Private (Admin) |
| `PATCH` | `/api/v1/admin/products/bulk-approve` | Approve multiple pending products in a single batch | Private (Admin) |
| `PATCH` | `/api/v1/admin/products/:id/block` | Block a product listing | Private (Admin) |
| `GET` | `/api/v1/admin/orders` | Get list of all platform orders | Private (Admin) |
| `GET` | `/api/v1/admin/orders/:id` | Get full details of a specific order | Private (Admin) |
| `PATCH` | `/api/v1/admin/orders/:id/status` | Override order status manually | Private (Admin) |

---

## 🔐 Auth Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Register a new user (initializes OTP verification flow) | Public |
| `POST` | `/api/v1/auth/verify` | Verify OTP sent during registration to activate account | Public |
| `POST` | `/api/v1/auth/resend` | Resend OTP for registration if not received or expired | Public |
| `POST` | `/api/v1/auth/login` | Authenticate user using email/phone and password | Public (Rate Limited) |
| `POST` | `/api/v1/auth/refresh-token` | Generate a new access token using a valid refresh token | Public (Requires refreshToken in cookies/body) |
| `POST` | `/api/v1/auth/forgot-password` | Request a password reset link via email | Public |
| `POST` | `/api/v1/auth/reset-password/:token` | Reset password using a valid reset token from email | Public |
| `POST` | `/api/v1/auth/logout` | Revoke refresh token and clear auth cookies | Private (JWT) |
| `GET` | `/api/v1/auth/current-user` | Retrieve profile data for the authenticated user | Private (JWT) |
| `GET` | `/api/v1/auth/me` | Convenience alias for current-user | Private (JWT) |
| `POST` | `/api/v1/auth/change-password` | Update password for the logged-in user | Private (JWT) |
| `PATCH` | `/api/v1/auth/update-profile` | Update profile info and upload avatar image | Private (JWT) |

---

## 🏷️ Brand Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/brands` | Get all brands with pagination and search | Public |
| `GET` | `/api/v1/brands/by-category/:categoryId` | Get brands relevant to a specific category (hierarchical) | Public |
| `POST` | `/api/v1/brands` | Create a new brand | Private/Admin |
| `PATCH` | `/api/v1/brands/:id` | Update an existing brand | Private/Admin |
| `DELETE` | `/api/v1/brands/:id` | Delete a brand | Private/Admin |

---

## 🛒 Cart Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/user/cart/` | Get current user's shopping cart | Private |
| `POST` | `/api/v1/user/cart/items` | Add a product to shopping cart | Private |
| `PATCH` | `/api/v1/user/cart/items/:productId` | Update quantity of a cart item | Private |
| `DELETE` | `/api/v1/user/cart/items/:productId` | Remove an item from shopping cart | Private |
| `DELETE` | `/api/v1/user/cart/clear` | Remove all items from shopping cart | Private |
| `POST` | `/api/v1/user/cart/move-to-wishlist/:productId` | Move a cart item to user's wishlist | Private |

---

## 📁 Category Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/categories/root` | Get all root-level categories (top of the hierarchy) | Public |
| `GET` | `/api/v1/categories/tree` | Return the full nested category tree structure | Public |
| `GET` | `/api/v1/categories/:parentId/children` | Get all direct children categories for a specific parent | Public |
| `GET` | `/api/v1/categories/:id/breadcrumb` | Return full hierarchical path (breadcrumb) for a category | Public |
| `POST` | `/api/v1/categories` | Create a new category (Admin Only) | Private (Admin) |
| `PATCH` | `/api/v1/categories/:id` | Update existing category details or image | Private (Admin) |
| `PATCH` | `/api/v1/categories/:id/toggle` | Toggle category active/inactive status (affects visibility) | Private (Admin) |
| `DELETE` | `/api/v1/categories/:id` | Delete a category and handle its children (recursive logic) | Private (Admin) |
| `GET` | `/api/v1/categories/:id/stats` | Get performance and inventory statistics for a category | Private (Admin) |

---

## 🖼️ Home Slider Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/slider/slides` | Get all active slider images for the homepage | Public |
| `PATCH` | `/api/v1/slider/admin/slides/reorder` | Reorder slides sequence | Private (Admin) |
| `PATCH` | `/api/v1/slider/admin/slides/bulk-update` | Bulk update multiple slides (status, duration, etc.) | Private (Admin) |
| `GET` | `/api/v1/slider/admin/slides/stats` | Get slider performance and inventory statistics | Private (Admin) |
| `GET` | `/api/v1/slider/admin/slides` | Get list of all slides (including inactive) | Private (Admin) |
| `POST` | `/api/v1/slider/admin/slides` | Create a new homepage slider | Private (Admin) |
| `GET` | `/api/v1/slider/admin/slides/:id` | Get details of a specific slide | Private (Admin) |
| `PUT` | `/api/v1/slider/admin/slides/:id` | Update slide details or replace image | Private (Admin) |
| `DELETE` | `/api/v1/slider/admin/slides/:id` | Soft delete (deactivate) a slide | Private (Admin) |
| `PATCH` | `/api/v1/slider/admin/slides/:id/toggle` | Toggle slide active/inactive status | Private (Admin) |
| `DELETE` | `/api/v1/slider/admin/slides/:id/permanent` | Permanently delete a slide and its Cloudinary assets | Private (Admin) |

---

## 🔢 HSN Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/hsn` | Get all HSN codes with pagination and search | Public |
| `GET` | `/api/v1/hsn/:id` | Get details of a specific HSN code | Public |
| `POST` | `/api/v1/hsn` | Create a new HSN code | Private (Admin) |
| `POST` | `/api/v1/hsn/bulk` | Bulk insert multiple HSN codes from a JSON list | Private (Admin) |
| `PUT` | `/api/v1/hsn/:id` | Update an existing HSN code details | Private (Admin) |
| `PATCH` | `/api/v1/hsn/:id/toggle-status` | Toggle HSN code active/inactive status | Private (Admin) |
| `DELETE` | `/api/v1/hsn/:id` | Delete an HSN code from the database | Private (Admin) |

---

## 📦 Inventory Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/inventory/:productId` | Get inventory status for a specific product | Private (Owner/Admin) |
| `PATCH` | `/api/v1/inventory/:productId` | Update stock levels for a specific product | Private (Owner/Admin/Vendor) |

---

## 📄 Invoice Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/invoice/my-invoices` | Get all invoices for the currently logged-in user | Private |
| `GET` | `/api/v1/invoice/order/:orderId` | Get invoice details for a specific order ID | Private (Owner/Vendor/Admin) |
| `GET` | `/api/v1/invoice/:invoiceId/view` | Get full details of a specific invoice | Private (Owner/Vendor/Admin) |
| `GET` | `/api/v1/invoice/:invoiceId/download` | Download invoice PDF or get PDF URL | Private (Owner/Vendor/Admin) |
| `POST` | `/api/v1/invoice/:invoiceId/resend-email` | Resend invoice PDF to customer's email | Private (Owner/Admin) |

---

## 🧾 Orders Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/v1/orders/create-razorpay-order` | Create a new Razorpay order for secure online payment processing | Private |
| `POST` | `/api/v1/orders/verify-payment` | Verify Razorpay payment signature and confirm the order | Private |
| `GET` | `/api/v1/orders/vendor/my-orders` | Get all orders containing products from the current vendor | Private (Vendor) |
| `PATCH` | `/api/v1/orders/:orderId/status` | Update status of an order (Vendor limited access) | Private (Vendor) |
| `POST` | `/api/v1/orders/:orderId/verify-delivery-otp` | Verify delivery OTP and mark order as delivered | Private (Vendor/Admin) |
| `PATCH` | `/api/v1/orders/:orderId/items/:itemId/track` | Update tracking information for a specific order item | Private (Vendor) |
| `GET` | `/api/v1/orders/admin/all` | Get all platform orders with advanced filters | Private (Admin) |
| `PATCH` | `/api/v1/orders/:orderId/admin-cancel` | Cancel an order (Admin override) | Private (Admin) |
| `PATCH` | `/api/v1/orders/:orderId/admin-status` | Update order status (Admin override) | Private (Admin) |
| `POST` | `/api/v1/orders/:orderId/refund` | Process refund for an order via Razorpay | Private (Admin) |
| `GET` | `/api/v1/orders/:orderId/refund` | Get refund details for an order | Private (Owner/Admin) |
| `GET` | `/api/v1/orders/` | Get currently logged-in user's orders | Private |
| `POST` | `/api/v1/orders/` | Place a new order from cart (Supports **Online** only, COD disabled) | Private |
| `GET` | `/api/v1/orders/:orderId/history` | Get tracking timeline and history for an order | Private |
| `GET` | `/api/v1/orders/:orderId` | Get full details of a specific order | Private |
| `PATCH` | `/api/v1/orders/:orderId/cancel` | Cancel an order (User initiated) | Private |

---

## 🛍️ Products Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/products` | Get all products with advanced filtering and pagination | Public |
| `GET` | `/api/v1/products/search` | Full-text search for products with filters and sorting | Public |
| `GET` | `/api/v1/products/search/suggestions` | Get live search suggestions (brands, categories, products) | Public |
| `GET` | `/api/v1/products/vendor/my-products` | Get products listed by the logged-in vendor | Private/Vendor |
| `GET` | `/api/v1/products/vendor/:vendorId` | Get products listed by a specific vendor ID | Private/Vendor/Admin |
| `GET` | `/api/v1/products/stats/overview` | Get overview stats for vendor products | Private/Vendor/Admin |
| `GET` | `/api/v1/products/low-stock` | Get products with low stock for vendor | Private/Vendor/Admin |
| `GET` | `/api/v1/products/featured` | Get featured products | Public |
| `GET` | `/api/v1/products/trending` | Get trending products based on popularity | Public |
| `GET` | `/api/v1/products/latest` | Get latest added products | Public |
| `GET` | `/api/v1/products/offers` | Get products with active offers/discounts | Public |
| `GET` | `/api/v1/products/filters/brands` | Get all available brands from products (Legacy/Faceted fallback) | Public |
| `GET` | `/api/v1/products/id/:id` | Get single product by MongoDB ID | Public |
| `GET` | `/api/v1/products/slug/:slug` | Get single product by SEO slug | Public |
| `GET` | `/api/v1/products/:identifier` | Get product by either ID or Slug (identifier) | Public |
| `POST` | `/api/v1/products/compare` | Compare multiple products (2-4 items) | Public |
| `POST` | `/api/v1/products/recently-viewed` | Log a product as recently viewed by user | Public |
| `POST` | `/api/v1/products/recently-viewed/fetch` | Fetch product details for recently viewed history | Public |
| `POST` | `/api/v1/products` | Create a new product listing | Private/Vendor/Admin |
| `PATCH` | `/api/v1/products/:id` | Update an existing product listing | Private/Vendor/Admin |
| `DELETE` | `/api/v1/products/:id` | Soft delete a product (mark inactive) | Private/Vendor/Admin |
| `PATCH` | `/api/v1/products/:id/stock` | Update product stock levels | Private/Vendor/Admin |
| `PATCH` | `/api/v1/products/:id/featured` | Toggle product featured status | Private/Admin |
| `PATCH` | `/api/v1/products/:id/trending` | Toggle product trending status | Private/Admin |
| `PATCH` | `/api/v1/products/:id/base-price` | Update product base price (Admin/Owner only) | Private/Vendor/Admin |
| `PATCH` | `/api/v1/products/:id/toggle-status` | Toggle product active/inactive status | Private/Vendor/Admin |
| `POST` | `/api/v1/products/bulk` | Bulk update multiple products | Private/Admin |
| `DELETE` | `/api/v1/products/:id/permanent` | Permanently delete a product and its assets | Private/Admin |
| `PATCH` | `/api/v1/products/:id/review` | Add or update an internal review for a product | Private/Admin |
| `PATCH` | `/api/v1/products/:id/rating` | Force update product rating/review stats | Private/Admin |

---

## ⭐ Product Review Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/reviews/product/:productId` | Get all reviews for a specific product | Public |
| `GET` | `/api/v1/reviews/my-reviews` | Get current user's reviews | Private |
| `POST` | `/api/v1/reviews/add` | Create a new product review | Private |
| `PUT` | `/api/v1/reviews/:reviewId` | Update an existing review | Private/Owner/Admin |
| `DELETE` | `/api/v1/reviews/:reviewId` | Delete a review | Private/Owner/Admin |
| `POST` | `/api/v1/reviews/:reviewId/helpful` | Increment helpful vote count for a review | Private |
| `GET` | `/api/v1/reviews/vendor/my-reviews` | Get all reviews for products belonging to the current vendor | Private/Vendor |
| `PATCH` | `/api/v1/reviews/vendor/:reviewId/respond` | Allow vendor to respond to a review | Private/Vendor |
| `GET` | `/api/v1/reviews/admin/all` | Get all reviews for administration | Private/Admin |
| `PATCH` | `/api/v1/reviews/admin/:reviewId/status` | Update review status (active, hidden, flagged) | Private/Admin |

---

## 🔍 Search Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/search/` | Full-text search for products with filters and sorting | Public |
| `GET` | `/api/v1/search/suggestions` | Get live search suggestions (brands, categories, products) | Public |
| `POST` | `/api/v1/search/recently-viewed/fetch` | Fetch product details for recently viewed IDs | Public |
| `POST` | `/api/v1/search/recently-viewed` | Log a product as recently viewed | Public |
| `POST` | `/api/v1/search/compare` | Compare multiple products (2-4 products) | Public |

---

## ⚙️ Settings Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/settings/me` | Get currently logged-in vendor's account and notification settings | Private (Vendor) |
| `PATCH` | `/api/v1/settings/me` | Update currently logged-in vendor's account and notification settings | Private (Vendor) |
| `GET` | `/api/v1/settings/:userId` | Get account and notification settings for a specific user ID | Private (Admin) |
| `PATCH` | `/api/v1/settings/:userId` | Update account and notification settings for a specific user ID | Private (Admin) |

---

## 🏬 Shop Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/shop/` | Get all active shops with filtering and search | Public |
| `GET` | `/api/v1/shop/slug/:slug` | Get shop details by its unique slug | Public |
| `GET` | `/api/v1/shop/code/:shopCode` | Get shop details by its unique vendor code | Public |
| `GET` | `/api/v1/shop/admin/stats` | Get comprehensive shop statistics (Admin dashboard) | Private (Admin) |
| `GET` | `/api/v1/shop/admin/all` | Get list of all shops for administration | Private (Admin) |
| `GET` | `/api/v1/shop/admin/verification-requests` | Get pending shop verification requests | Private (Admin) |
| `GET` | `/api/v1/shop/admin/verification-requests/:shopId` | Get full details of a specific verification request | Private (Admin) |
| `PATCH` | `/api/v1/shop/admin/:shopId/deactivate` | Force deactivate a shop (Soft delete) | Private (Admin) |
| `PATCH` | `/api/v1/shop/:shopId/verify` | Approve or reject a shop verification request | Private (Admin) |
| `GET` | `/api/v1/shop/vendor/my` | Get currently logged-in vendor's shop details | Private (Vendor) |
| `GET` | `/api/v1/shop/vendor/my/verification-status` | Get current status of shop verification | Private (Vendor) |
| `POST` | `/api/v1/shop/vendor/my/request-verification` | Submit documents for shop verification | Private (Vendor) |
| `POST` | `/api/v1/shop/` | Register a new shop (Vendor initial setup) | Private (Vendor) |
| `PATCH` | `/api/v1/shop/update/:shopId` | Update shop profile details | Private (Vendor/Admin) |
| `DELETE` | `/api/v1/shop/delete/:shopId` | Permanently delete a shop and its assets | Private (Vendor/Admin) |
| `DELETE` | `/api/v1/shop/:shopId/logo` | Remove shop logo image | Private (Vendor/Admin) |
| `DELETE` | `/api/v1/shop/:shopId/banner` | Remove shop banner image | Private (Vendor/Admin) |
| `PATCH` | `/api/v1/shop/:shopId/toggle-status` | Toggle shop availability status | Private (Vendor) |
| `GET` | `/api/v1/shop/:shopId` | Get shop details by ID | Private (Vendor/Admin) |

---

## 🏪 Shop Review Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/shop-reviews/shop/:shopId` | Get all reviews and rating stats for a specific shop | Public |
| `POST` | `/api/v1/shop-reviews/add` | Add a new review for a shop (with optional image uploads) | Private |
| `PATCH` | `/api/v1/shop-reviews/:reviewId` | Update an existing shop review (Owner only) | Private (Owner) |
| `DELETE` | `/api/v1/shop-reviews/:reviewId` | Delete a shop review (Owner or Admin) | Private (Owner/Admin) |
| `POST` | `/api/v1/shop-reviews/:reviewId/helpful` | Increment the helpful vote count for a shop review | Private |
| `PATCH` | `/api/v1/shop-reviews/vendor/:reviewId/respond` | Allow vendor to respond to a customer review for their shop | Private (Vendor) |

---

## 👔 Vendor Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/vendor/orders/` | Get all orders containing products from the current vendor | Private (Vendor) |
| `GET` | `/api/v1/vendor/orders/:id` | Get full details of a specific order for the vendor | Private (Vendor) |
| `POST` | `/api/v1/vendor/orders/:id/send-delivery-otp` | Send delivery confirmation OTP to customer | Private (Vendor) |
| `PATCH` | `/api/v1/vendor/orders/:id/status` | Update order status with transition logic and OTP verification for delivery | Private (Vendor) |

---

## 👔 Vendor Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/vendor/dashboard/stats` | Get real-time business statistics for the vendor dashboard | Private (Vendor) |
| `GET` | `/api/v1/vendor/inventory/report` | Get comprehensive inventory status and low-stock reports | Private (Vendor) |
| `USE` | `/api/v1/vendor/orders` | Sub-router for vendor-specific order management | Private (Vendor) |

---

## ❤️ Wishlist Module

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/user/wishlist/` | Get all items in user's wishlist | Private |
| `POST` | `/api/v1/user/wishlist/add` | Add a product to wishlist | Private |
| `DELETE` | `/api/v1/user/wishlist/clear` | Remove all items from wishlist | Private |
| `DELETE` | `/api/v1/user/wishlist/remove/:productId` | Remove a specific product from wishlist | Private |
| `POST` | `/api/v1/user/wishlist/move-to-cart/:productId` | Move an item from wishlist to shopping cart | Private |
| `POST` | `/api/v1/user/wishlist/move-from-cart/:productId` | Move an item from cart to wishlist | Private |

---

