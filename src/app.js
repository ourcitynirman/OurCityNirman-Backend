import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import morgan from "morgan"
import rateLimit from "express-rate-limit"
import dotenv from 'dotenv';
dotenv.config();

const app = express()

app.set('trust proxy', true); // Enable trusting proxy (recommended for Nginx/Cloudflare)

// ─── LOGGING (Morgan) 
app.use(morgan("dev"));

// ─── RATE LIMITING (Security)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 to prevent frequent rate limiting
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
  validate: { xForwardedForHeader: false }, // Suppress the validation warning as 'trust proxy' is already set
});
app.use("/api/", limiter); // Apply to all API routes

// const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5174")
//   .split(",")
//   .map(o => o.trim());

// app.use(cors({
//   origin: (origin, callback) => {
//     if (!origin) return callback(null, true);
//     if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
//     callback(new Error(`CORS blocked: ${origin}`));
//   },
//   credentials: true,
// }));

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5174")
  .split(",")
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

    if (isAllowed) return callback(null, true);

    console.error(`CORS blocked: ${origin}`);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

const isDev = process.env.NODE_ENV !== "production";

app.use(
  helmet({
    contentSecurityPolicy: isDev
      ? false  // CSP disabled in development — no issues will occur
      : {
        directives: {
          defaultSrc: ["'self'"],
          frameSrc: [
            "'self'",
            "https://*.razorpay.com",
            "https://api.razorpay.com",
            "https://checkout.razorpay.com",
            "https://www.google.com",
            "https://maps.google.com",
            "https://*.google.com",
          ],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://checkout.razorpay.com",
          ],
          connectSrc: [
            "'self'",
            "https://*.razorpay.com",
            "https://api.razorpay.com",
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https://*.razorpay.com",
            "https://res.cloudinary.com", // if using Cloudinary
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
  })
);

// ─── BODY PARSERS 
app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(cookieParser())
app.use(express.static("public"))

// ─── ROUTES IMPORT 
import auth from './routes/auth.route.js'
import reviewRoute from './routes/review.route.js'
import Addressrouter from "./routes/address/address.route.js";
import CartRouter from "./routes/cart.route.js";
import ShopRouter from "./routes/shop/shop.routes.js";
import AdminRouter from "./routes/admin/admin.route.js";
import ProductsRoute from "./routes/Products/products.route.js";
import WishlistRouter from "./routes/wishlist/Wishlist.routes.js";
import SearchRoute from "./routes/Products/search.route.js";
import OrderRouter from "./routes/order/Order.routes.js";
import VendorOrderrouter from "./routes/vendor/Vendor.order.routes.js";
import SliderRoute from "./routes/homeslider/homeslider.route.js";
import InvoiceRouter from "./routes/invoice/invoice.route.js";
import errorHandler from './middlewares/Errorhandler.middleware.js';

app.use("/api/v1/auth", auth)

// user  routes
app.use("/api/v1/product", ProductsRoute)
app.use("/api/v1/products", SearchRoute)

// address  routes
app.use("/api/v1/user/address", Addressrouter)
app.use("/api/v1/user/wishlist", WishlistRouter)

// cart  routes
app.use("/api/v1/user/cart", CartRouter)

// vendor  routes
app.use("/api/v1/shop", ShopRouter)
app.use("/api/v1/vendor/orders", VendorOrderrouter)

// order  routes
app.use("/api/v1/orders", OrderRouter)

// review  routes
app.use("/api/v1/reviews", reviewRoute)

// admin  routes
app.use("/api/v1/admin", AdminRouter)
app.use("/api/v1/slider", SliderRoute)
app.use("/api/v1/invoice", InvoiceRouter)

app.use(errorHandler);

export { app }
