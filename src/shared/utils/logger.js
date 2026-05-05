import winston from 'winston';

const { combine, timestamp, printf, colorize, json, metadata } = winston.format;

const customFormat = printf(({ level, message, timestamp, metadata }) => {
    let msg = `${timestamp} [${level}]: ${message} `;
    if (metadata && Object.keys(metadata).length > 0) {
        msg += JSON.stringify(metadata);
    }
    return msg;
});

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] })
    ),
    transports: [
        // Console logging
        new winston.transports.Console({
            format: combine(
                colorize(),
                customFormat
            )
        }),
        // Error log file
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            format: combine(json())
        }),
        // Combined log file
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            format: combine(json())
        })
    ]
});

export default logger;
