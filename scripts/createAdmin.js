
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const userSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true },
        email: { type: String, required: true, unique: true, lowercase: true },
        phone: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: {
            type: String,
            enum: ['user', 'vendor', 'homeowner', 'labour', 'admin'],
            default: 'user',
        },
        isVerified: { type: Boolean, default: false },
        isActive: { type: Boolean, default: false },
        refreshToken: { type: String, select: false },
    },
    { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Admin credentials 
const ADMIN = {
    fullName: 'Diwakar Gupta',
    email: 'ourcitynirman@gmail.com',
    phone: '8553866059',
    password: 'India@12',
    role: 'admin',
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
    await mongoose.connect(uri);
    console.log('  Connected');

    // Check if admin already exists
    const existing = await User.findOne({ email: ADMIN.email });
    if (existing) {
        console.log(`   Admin already exists  ${ADMIN.email}`);
        console.log('     Delete it from the DB first if you want to re-seed.');
        await mongoose.disconnect();
        process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(ADMIN.password, 10);

    await User.create({ ...ADMIN, password: hashedPassword });


    console.log(`  Email    : ${ADMIN.email}`);
    console.log(`  Password : ${ADMIN.password}`);
    console.log(`  Role     : ${ADMIN.role}`);


    await mongoose.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});