import ApiError from '../utils/ApiError.js';

const errorHandler = (err, req, res, next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors ?? [],
        });
    }
    console.error(' ERROR:', err.message);
    console.error(' STACK:', err.stack);

    const statusCode = err.statusCode ?? err.status ?? 500;
    const message = err.message ?? "Internal Server Error";

    return res.status(statusCode).json({
        success: false,
        message,
        errors: [],
    });
};

export default errorHandler;