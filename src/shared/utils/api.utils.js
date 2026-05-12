/**
 * @desc    Standard API Error class for consistent error handling.
 */
class ApiError extends Error {
    constructor(statusCode, message = "Something went wrong", errors = [], stack = "") {
        if (typeof statusCode === "string" && typeof message === "number") {
            [statusCode, message] = [message, statusCode];
        }
        super(message);
        this.statusCode = statusCode || 500;
        this.message = message;
        this.success = false;
        this.errors = errors;
        if (stack) this.stack = stack;
        else Error.captureStackTrace(this, this.constructor);
    }

    static fromZodError(err) {
        if (err.name !== 'ZodError') return err;
        const messages = (err.errors || []).map(e => e.message).join(', ') || err.message;
        return new ApiError(400, `Validation Error: ${messages}`, err.errors || []);
    }
}

/**
 * @desc    Standard API Response class
 */
class ApiResponse {
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}

/**
 * @desc    Wrapper for async route handlers. 
 *          Express 5 handles promises, but we keep this for Zod auto-formatting.
 */
export const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        // Ensure next is a function, otherwise define a dummy one
        const n = typeof next === 'function' ? next : ((e) => {
            console.error('[CRITICAL] asyncHandler received no next function!', e);
        });

        Promise.resolve(requestHandler(req, res, n)).catch((err) => {
            if (err.name === 'ZodError') {
                return n(ApiError.fromZodError(err));
            }
            n(err);
        });
    };
};

export { ApiError, ApiResponse };
