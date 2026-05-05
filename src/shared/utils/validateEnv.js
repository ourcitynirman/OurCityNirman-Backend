/**
 * @file    validateEnv.js
 * @desc    Validates required environment variables at server startup.
 *          Fails fast in production if any critical variable is missing.
 */

const REQUIRED_VARS = [
    'MONGODB_URI',
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'RESET_PASSWORD_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'EMAIL_HOST',
    'EMAIL_USER',
    'EMAIL_PASS',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
];

export function validateEnv() {
    const missing = REQUIRED_VARS.filter(key => !process.env[key]);

    if (missing.length > 0) {
        const isProd = process.env.NODE_ENV === 'production';
        const msg = `Missing environment variables:\n  ${missing.join('\n  ')}`;

        if (isProd) {
            // Hard fail in production — never run with incomplete config
            console.error(`\n❌ STARTUP FAILED — ${msg}\n`);
            process.exit(1);
        } else {
            // Warn in development — allow partial runs for testing
            console.warn(`\n⚠️  WARNING — ${msg}\n  (Some features may not work)\n`);
        }
    } else {
        console.log('✅  Environment variables validated.');
    }
}
