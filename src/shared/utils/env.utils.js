import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * @desc    Smart environment loader.
 *          Loads the correct .env file based on NODE_ENV.
 */
export function loadEnv() {
    const env = process.env.NODE_ENV || 'development';
    const envFiles = [`.env.${env}`, `.env`];

    for (const file of envFiles) {
        const fullPath = resolve(process.cwd(), file);
        if (existsSync(fullPath)) {
            dotenv.config({ path: fullPath, override: false });
            console.log(`📄  Loaded env: ${file}  [NODE_ENV=${env}]`);
        }
    }
}

/**
 * @desc    Validates required environment variables at server startup.
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
            console.error(`\n❌ STARTUP FAILED — ${msg}\n`);
            process.exit(1);
        } else {
            console.warn(`\n⚠️  WARNING — ${msg}\n  (Some features may not work)\n`);
        }
    } else {
        console.log('✅  Environment variables validated.');
    }
}
