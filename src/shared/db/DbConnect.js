/**
 * @file    DbConnect.js
 * @desc    MongoDB connection with production-grade options and retry logic.
 */

import mongoose from 'mongoose';
import { DB_NAME } from '../../constants.js';

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error('MONGODB_URI is not defined in environment variables.');
    }

    const options = {
        dbName: DB_NAME,
        // Connection pool
        maxPoolSize: 10,
        minPoolSize: 2,
        // Timeouts
        serverSelectionTimeoutMS: 5_000,  // fail fast if Atlas unreachable
        socketTimeoutMS: 45_000,
        connectTimeoutMS: 10_000,
        // Heartbeat
        heartbeatFrequencyMS: 10_000,
    };

    // Handle connection events
    mongoose.connection.on('connected',    () => console.log('🟢  MongoDB connected'));
    mongoose.connection.on('disconnected', () => console.warn('🔴  MongoDB disconnected'));
    mongoose.connection.on('error',        (err) => console.error('🔴  MongoDB error:', err.message));

    await mongoose.connect(uri, options);

    const { host, name } = mongoose.connection;
    console.log(`📦  Database: ${name}  (${host})`);
};

export default connectDB;