import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const userSchema = new mongoose.Schema({ email: String, fullName: String });
const User = mongoose.models.User || mongoose.model('User', userSchema);

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({}, 'email fullName role');
    console.log('--- Current Users in DB ---');
    users.forEach(u => console.log(`- "${u.email}" (${u.fullName})`));
    await mongoose.disconnect();
}

main();
