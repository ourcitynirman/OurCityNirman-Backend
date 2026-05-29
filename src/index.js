/**
 * @file    index.js
 * @desc    Application entry point — bootstraps environment, DB, and HTTP server.
 *          Handles graceful shutdown on SIGTERM / SIGINT (required for production).
 */

// ── 1. Load environment FIRST (before any other import uses process.env) ──
import { loadEnv, validateEnv } from './shared/utils/env.utils.js';
loadEnv();

// ── 2. Validate required env vars ─────────────────────────────────────────
validateEnv();

// ── 3. App & DB ────────────────────────────────────────────────────────────
import connectDB from './shared/db/DbConnect.js';
import { app }   from './app.js';

const PORT = parseInt(process.env.PORT, 10) || 5000;

// ── 4. Boot sequence ───────────────────────────────────────────────────────
connectDB()
    .then(() => {
        const server = app.listen(PORT, () => {
            const isProd = process.env.NODE_ENV === 'production';
            const base = isProd ? (process.env.FRONTEND_URL || 'https://www.ourcitynirman.com').replace(/\/$/, '') : `http://localhost:${PORT}`;
            
            console.log(`\n⚙️   Server  →  ${base}  [${process.env.NODE_ENV}]`);
            console.log(`🔗  Health  →  ${base}/api/v1/health`);
            console.log(`🚀  Backend reloaded at: ${new Date().toLocaleTimeString()}\n`);
        }); 


        // ── Graceful Shutdown ──────────────────────────────────────────────
        const shutdown = (signal) => {
            console.log(`\n${signal} received — shutting down gracefully...`);
            server.close(() => {
                console.log('✅  HTTP server closed.');
                process.exit(0);
            });

            // Force exit if server doesn't close within 10 s

            setTimeout(() => {
                console.error('❌  Forced shutdown after timeout.');
                process.exit(1);
            }, 10_000).unref();
        };


        
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT',  () => shutdown('SIGINT'));

        process.on('unhandledRejection', (reason) => {
            console.error('🔥  Unhandled Rejection:', reason);
            shutdown('unhandledRejection');
        });

        process.on('uncaughtException', (err) => {
            console.error('💥  Uncaught Exception:', err.message);
            shutdown('uncaughtException');
        });
    })
    .catch((err) => {
        console.error('❌  MongoDB connection failed:', err.message);
        process.exit(1);
    });
