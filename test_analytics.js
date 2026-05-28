import mongoose from 'mongoose';
import AdminService from './src/modules/admin/admin.service.js';

async function test() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ourcitynirman');
        console.log("Connected to MongoDB");
        const data = await AdminService.getAnalytics({ timeFilter: 'monthly' });
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        mongoose.disconnect();
    }
}
test();
