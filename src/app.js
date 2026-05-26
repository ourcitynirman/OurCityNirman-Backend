/**
 * @file    app.js
 * @desc    Express application bootstrap — middleware setup only.
 *          All route registrations are handled by routes.js (registerRoutes).
 */

import express      from 'express';
import cors         from 'cors';
import cookieParser from 'cookie-parser';
import helmet       from 'helmet';
import morgan       from 'morgan';
import rateLimit    from 'express-rate-limit';
// import mongoSanitize from 'express-mongo-sanitize';
// import xss          from 'xss-clean';
// import csurf        from 'csurf';
// import dotenv       from 'dotenv'; // Handled in index.js

import { registerRoutes } from './routes.js';
import errorHandler       from './shared/middlewares/Errorhandler.middleware.js';

import logger from './shared/utils/logger.js';

// dotenv.config(); // Handled in index.js


const app = express();

// ─── PROXY TRUST ────────────────────────────────────────────────────────────
// Trust exactly one upstream proxy (Nginx / Render / Railway, etc.)
app.set('trust proxy', 1);

// ─── HTTP REQUEST LOGGER ────────────────────────────────────────────────────
app.use(morgan(
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
    { stream: { write: (message) => logger.info(message.trim()) } }
));

// ─── GLOBAL RATE LIMITER ────────────────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests from this IP. Please try again after 15 minutes.',
    },
    validate: { xForwardedForHeader: false }, // trust proxy already handles X-Forwarded-For
});
app.use('/api/', globalLimiter);

// ─── CORS ───────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5174')
    .split(',')
    .map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server calls (no Origin header)
        if (!origin) return callback(null, true);

        const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
        if (isAllowed) return callback(null, true);

        console.error(`[CORS] Blocked: ${origin}`);
        callback(new Error(`CORS policy: origin "${origin}" is not allowed.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept', 'Origin'],
}));

// ─── SECURITY HEADERS (Helmet) ───────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';

app.use(
    helmet({
        crossOriginResourcePolicy: !isDev,
        contentSecurityPolicy: isDev
            ? false  // Disabled in dev — allows HMR, browser devtools, etc.
            : {
                directives: {
                    defaultSrc: ["'self'"],
                    frameSrc: [
                        "'self'",
                        'https://*.razorpay.com',
                        'https://api.razorpay.com',
                        'https://checkout.razorpay.com',
                        'https://www.google.com',
                        'https://maps.google.com',
                        'https://*.google.com',
                    ],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        'https://checkout.razorpay.com',
                        'https://cdn.razorpay.com',
                        'https://*.razorpay.com',
                    ],
                    connectSrc: [
                        "'self'",
                        'https://api.postalpincode.in',
                        'https://*.razorpay.com',
                        'https://api.razorpay.com',
                    ],
                    imgSrc: [
                        "'self'",
                        'data:',
                        'https://*.razorpay.com',
                        'https://res.cloudinary.com',
                    ],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                },
            },
    })
);

// ─── BODY PARSERS ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// // ─── DATA SANITIZATION ─────────────────────────────────────────────────────
// // Data sanitization against NoSQL query injection
// app.use(mongoSanitize());

// // Data sanitization against XSS
// app.use(xss());

// // ─── CSRF PROTECTION ────────────────────────────────────────────────────────
// // csurf is deprecated and can cause issues with Postman/development. 
// // For production, ensure you have a robust CSRF strategy if using cookies.
// ─── CSRF TOKEN PROVIDER ──────────────────────────────────────────────────
// This satisfies frontend requests for CSRF tokens.
// Full CSRF protection is currently disabled to simplify development/Postman testing.
app.get('/api/v1/csrf-token', (req, res) => {
    res.status(200).json({ 
        success: true, 
        csrfToken: 'not-implemented-in-dev' 
    });
});

app.use(express.static('public'));

// ─── API ROUTES ──────────────────────────────────────────────────────────────
// All route modules are registered centrally in routes.js
registerRoutes(app);

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
// Must be registered AFTER all routes
app.use(errorHandler);

export { app };
