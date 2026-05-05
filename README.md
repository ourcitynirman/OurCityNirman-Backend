# OurCityNirman API Documentation

## Overview

This documentation defines a scalable e-commerce backend API built with a modular architecture.

* **Base URL:** `http://localhost:5000/api/v1`
* **Authentication:** JWT Based on (Access + Refresh Token)
* **Roles:** User, Vendor, Admin
* **Architecture:** RESTful + Feature-based modular structure

---

## Modules

* Address
* Authentication
* Admin
* Products
* Categories
* Cart
* Orders
* Inventory
* Reviews
* Shop
* Wishlist

---

## 1. Address Module

Manage user addresses.

| Method | Endpoint                        | Description             | Access  |
| ------ | ------------------------------- | ----------------------- | ------- |
| GET    | `/user/address/`                | Get all saved addresses | Private |
| POST   | `/user/address/add`             | Add new address         | Private |
| POST   | `/user/address/bulk`            | Add multiple addresses  | Private |
| GET    | `/user/address/:id`             | Get address by ID       | Private |
| PUT    | `/user/address/:id`             | Update address          | Private |
| DELETE | `/user/address/:id`             | Delete address          | Private |
| PATCH  | `/user/address/:id/set-default` | Set default address     | Private |

---

## 2. Authentication Module

Handles user authentication and account management.

| Method | Endpoint                      | Description               | Access  |
| ------ | ----------------------------- | ------------------------- | ------- |
| POST   | `/auth/register`              | Register new user         | Public  |
| POST   | `/auth/verify`                | Verify OTP                | Public  |
| POST   | `/auth/resend`                | Resend OTP                | Public  |
| POST   | `/auth/login`                 | Login user                | Public  |
| POST   | `/auth/refresh-token`         | Generate new access token | Public  |
| POST   | `/auth/forgot-password`       | Request password reset    | Public  |
| POST   | `/auth/reset-password/:token` | Reset password            | Public  |
| POST   | `/auth/logout`                | Logout user               | Private |
| GET    | `/auth/current-user`          | Get current user profile  | Private |
| PATCH  | `/auth/update-profile`        | Update user profile       | Private |

---

## 3. Admin Module

Platform-level management and moderation.

| Method | Endpoint                      | Description          |
| ------ | ----------------------------- | -------------------- |
| GET    | `/admin/stats`                | Dashboard statistics |
| GET    | `/admin/reports/finance`      | Financial reports    |
| GET    | `/admin/users`                | List all users       |
| PATCH  | `/admin/users/:id/block`      | Block/unblock user   |
| DELETE | `/admin/users/:id`            | Delete user          |
| GET    | `/admin/vendors`              | List all vendors     |
| PATCH  | `/admin/vendors/:id/verify`   | Verify vendor        |
| PATCH  | `/admin/products/:id/approve` | Approve product      |
| PATCH  | `/admin/products/:id/block`   | Block product        |
| GET    | `/admin/orders`               | List all orders      |

---

## 4. Product Module

Product listing and management.

| Method | Endpoint                | Description                          |
| ------ | ----------------------- | ------------------------------------ |
| GET    | `/products`             | Get all products (filters supported) |
| GET    | `/products/search`      | Search products                      |
| GET    | `/products/featured`    | Featured products                    |
| GET    | `/products/trending`    | Trending products                    |
| GET    | `/products/latest`      | Latest products                      |
| GET    | `/products/offers`      | Discounted products                  |
| GET    | `/products/:identifier` | Get single product                   |
| POST   | `/products`             | Create product                       |
| PATCH  | `/products/:id`         | Update product                       |
| DELETE | `/products/:id`         | Delete product                       |

---

## 5. Category Module

Hierarchical category management.

| Method | Endpoint                   | Description            |
| ------ | -------------------------- | ---------------------- |
| GET    | `/categories/root`         | Get root categories    |
| GET    | `/categories/tree`         | Get full category tree |
| GET    | `/categories/:id/children` | Get child categories   |
| POST   | `/categories`              | Create category        |
| PATCH  | `/categories/:id`          | Update category        |
| DELETE | `/categories/:id`          | Delete category        |

---

## 6. Cart Module

Shopping cart operations.

| Method | Endpoint                      | Description     |
| ------ | ----------------------------- | --------------- |
| GET    | `/user/cart/`                 | Get cart        |
| POST   | `/user/cart/items`            | Add item        |
| PATCH  | `/user/cart/items/:productId` | Update quantity |
| DELETE | `/user/cart/items/:productId` | Remove item     |
| DELETE | `/user/cart/clear`            | Clear cart      |

---

## 7. Orders Module

Handles order lifecycle and payment.

| Method | Endpoint                        | Description          |
| ------ | ------------------------------- | -------------------- |
| POST   | `/orders/`                      | Place order          |
| GET    | `/orders/`                      | Get user orders      |
| GET    | `/orders/:orderId`              | Order details        |
| PATCH  | `/orders/:orderId/cancel`       | Cancel order         |
| POST   | `/orders/create-razorpay-order` | Create payment order |
| POST   | `/orders/verify-payment`        | Verify payment       |

---

## 8. Inventory Module

Stock and inventory management.

| Method | Endpoint                | Description      |
| ------ | ----------------------- | ---------------- |
| GET    | `/inventory/:productId` | Get stock status |
| PATCH  | `/inventory/:productId` | Update stock     |

---

## 9. Review Module

Product review system.

| Method | Endpoint                      | Description         |
| ------ | ----------------------------- | ------------------- |
| GET    | `/reviews/product/:productId` | Get product reviews |
| POST   | `/reviews/add`                | Add review          |
| PUT    | `/reviews/:reviewId`          | Update review       |
| DELETE | `/reviews/:reviewId`          | Delete review       |

---

## 10. Shop Module

Vendor shop management.

| Method | Endpoint               | Description      |
| ------ | ---------------------- | ---------------- |
| GET    | `/shop/`               | Get all shops    |
| GET    | `/shop/:shopId`        | Get shop details |
| POST   | `/shop/`               | Create shop      |
| PATCH  | `/shop/update/:shopId` | Update shop      |
| DELETE | `/shop/delete/:shopId` | Delete shop      |

---

## 11. Wishlist Module

User wishlist functionality.

| Method | Endpoint                           | Description    |
| ------ | ---------------------------------- | -------------- |
| GET    | `/user/wishlist/`                  | Get wishlist   |
| POST   | `/user/wishlist/add`               | Add item       |
| DELETE | `/user/wishlist/remove/:productId` | Remove item    |
| DELETE | `/user/wishlist/clear`             | Clear wishlist |

---

