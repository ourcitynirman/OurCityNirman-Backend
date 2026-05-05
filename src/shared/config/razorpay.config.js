import Razorpay from 'razorpay';

let _instance = null;

export function getRazorpay() {
    if (!_instance) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env');
        }
        _instance = new Razorpay({
            key_id:     process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return _instance;
}

export const razorpay = new Proxy({}, {
    get(_, prop) {
        return getRazorpay()[prop];
    }
});