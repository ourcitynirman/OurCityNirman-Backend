// PM2 ecosystem config (CommonJS — .cjs extension required with "type":"module")
module.exports = {
    apps: [
        {
            name        : 'ourcitynirman-backend',
            script      : 'src/index.js',
            interpreter : 'node',

            // Run 2 instances (cluster mode for multi-core CPUs)
            // Use 'max' to use all available CPU cores
            instances   : 2,
            exec_mode   : 'cluster',

            // Restart settings
            autorestart : true,
            watch       : false,
            max_memory_restart: '512M',
            restart_delay: 3000,          // Wait 3s before restart

            // Environment — production
            env_production: {
                NODE_ENV : 'production',
                PORT     : 5000,
            },

            // Environment — local test (npm run pm2:dev)
            env_development: {
                NODE_ENV : 'development',
                PORT     : 5000,
            },

            // Logging
            out_file    : './logs/pm2-out.log',
            error_file  : './logs/pm2-err.log',
            merge_logs  : true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

            // Graceful shutdown timeout
            kill_timeout: 10000,           // matches our shutdown() timeout in index.js
            listen_timeout: 8000,
        },
    ],
};
