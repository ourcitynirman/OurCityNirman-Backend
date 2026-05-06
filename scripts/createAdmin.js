import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// 2. Import the actual User model and Constants
import { User } from '../src/modules/auth/user.model.js';
import { DB_NAME } from '../src/constants.js';
import { ROLES } from '../src/shared/constants/roles.js';

// 3. Admin credentials 
const ADMIN_DATA = {
    fullName: 'Diwakar Gupta',
    email: 'ourcitynirman@gmail.com',
    phone: '8553866059',
    password: 'India@12',
    role: ROLES.ADMIN,
    isVerified: true,
    isActive: true,
};

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌  MONGODB_URI not found in .env');
        process.exit(1);
    }

    console.log('🔌  Connecting to MongoDB…');
    try {
        await mongoose.connect(uri, { dbName: DB_NAME });
        console.log(`✅  Connected to database: ${DB_NAME}`);

        // Check if admin already exists
        const existing = await User.findOne({ email: ADMIN_DATA.email.toLowerCase() });
        
        if (existing) {
            console.log(`ℹ️  Admin already exists: ${ADMIN_DATA.email}`);
            console.log('🔄  Updating password and status to ensure access...');
            
            existing.password = ADMIN_DATA.password; // Model pre-save hook will hash this
            existing.isVerified = true;
            existing.isActive = true;
            existing.role = ROLES.ADMIN;
            
            await existing.save();
            console.log('✅  Admin account updated successfully.');
        } else {
            console.log(`🆕  Creating new admin: ${ADMIN_DATA.email}`);
            // We pass the raw password; the User model's pre-save hook in user.model.js handles hashing
            await User.create(ADMIN_DATA);
            console.log('✅  Admin account created successfully.');
        }

        console.log('\n--- Admin Credentials ---');
        console.log(`Email    : ${ADMIN_DATA.email}`);
        console.log(`Password : ${ADMIN_DATA.password}`);
        console.log(`Role     : ${ADMIN_DATA.role}`);
        console.log('--------------------------\n');

    } catch (error) {
        console.error('❌  Operation failed:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

main();