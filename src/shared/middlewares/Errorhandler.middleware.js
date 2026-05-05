/**
 * @file    Errorhandler.middleware.js
 * @desc    Global Express error handler — production-safe.
 *          - Never leaks stack traces to clients in production.
 *          - Handles Mongoose-specific errors gracefully.
 *          - Cleans up temp uploaded files on any error.
 */

import { ApiError } from "../utils/api.utils.js";
import { cleanupTempFile, cleanupTempFiles } from './multer.middleware.js';
import logger from "../utils/logger.js";

const IS_PROD = process.env.NODE_ENV === 'production';

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars

    // ── Temp file cleanup ────────────────────────────────────────────────
    if (req.file)  cleanupTempFile(req.file.path);
    if (req.files) {
        const files = Array.isArray(req.files)
            ? req.files
            : Object.values(req.files).flat();
        cleanupTempFiles(files.map(f => f.path));
    }

    // ── Structured logging (server-side only) ───────────────────────────
    if (!IS_PROD || err.statusCode >= 500) {
        logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
            stack: !IS_PROD ? err.stack : undefined,
            statusCode: err.statusCode || 500
        });
    }

    // ── Known API error ──────────────────────────────────────────────────
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success : false,
            message : err.message,
            errors  : err.errors ?? [],
        });
    }

    // ── Mongoose Duplicate Key (E11000) ──────────────────────────────────
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
        const value = err.keyValue?.[field] ?? 'unknown';
        return res.status(409).json({
            success : false,
            message : `${field} "${value}" already exists.`,
            errors  : [],
        });
    }

    // ── Mongoose Validation Error ─────────────────────────────────────────
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(422).json({
            success : false,
            message : 'Validation failed',
            errors,
        });
    }

    // ── Mongoose Cast Error (invalid ObjectId etc.) ───────────────────────
    if (err.name === 'CastError') {
        return res.status(400).json({
            success : false,
            message : `Invalid value for field "${err.path}".`,
            errors  : [],
        });
    }

    // ── JWT Errors ────────────────────────────────────────────────────────
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token.', errors: [] });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired.', errors: [] });
    }

    // ── Generic Fallback ──────────────────────────────────────────────────
    const statusCode = err.statusCode ?? err.status ?? 500;
    return res.status(statusCode).json({
        success : false,
        message : IS_PROD ? 'Something went wrong. Please try again.' : (err.message ?? 'Internal Server Error'),
        errors  : [],
    });
};

export default errorHandler;