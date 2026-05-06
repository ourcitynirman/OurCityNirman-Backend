import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';

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
 * @desc    Validates required environment variables at server startup using Zod.
 */
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    MONGODB_URI: z.string().url(),
    ACCESS_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_SECRET: z.string().min(32),
    RESET_PASSWORD_SECRET: z.string().min(32).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    EMAIL_HOST: z.string().optional(),
    EMAIL_USER: z.string().email().optional(),
    EMAIL_PASS: z.string().optional(),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
});

export function validateEnv() {
    try {
        const parsed = envSchema.safeParse(process.env);
        
        if (!parsed.success) {
            const isProd = process.env.NODE_ENV === 'production';
            const errors = parsed.error.format();
            const msg = `Invalid environment variables: ${JSON.stringify(errors, null, 2)}`;

            if (isProd) {
                console.error(`\n❌ STARTUP FAILED — ${msg}\n`);
                process.exit(1);
            } else {
                console.warn(`\n⚠️  WARNING — ${msg}\n  (Some features may not work)\n`);
            }
        } else {
            console.log('✅  Environment variables validated successfully.');
        }
    } catch (error) {
        console.error('Environment validation failed:', error);
    }
}
