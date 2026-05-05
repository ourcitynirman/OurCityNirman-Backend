/**
 * @file    loadEnv.js
 * @desc    Smart environment loader.
 *          Loads the correct .env file based on NODE_ENV:
 *
 *          NODE_ENV=development  →  .env.development  (local dev)
 *          NODE_ENV=production   →  .env.production   (live server)
 *          (none set)            →  .env              (fallback)
 *
 *  Priority (highest → lowest):
 *    1. Actual process environment variables (set by Render/Railway/PM2)
 *    2. .env.<NODE_ENV> file
 *    3. .env file (base fallback)
 */

import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

export function loadEnv() {
    const env = process.env.NODE_ENV || 'development';

    // File priority list (first found wins for each key)
    const envFiles = [
        `.env.${env}`,   // e.g. .env.development or .env.production
        `.env`,          // fallback base
    ];

    for (const file of envFiles) {
        const fullPath = resolve(process.cwd(), file);
        if (existsSync(fullPath)) {
            // override: false means existing process.env values are NOT overwritten
            // (platform env vars like Render/Railway always take priority)
            dotenv.config({ path: fullPath, override: false });
            console.log(`📄  Loaded env: ${file}  [NODE_ENV=${env}]`);
        }
    }
}
