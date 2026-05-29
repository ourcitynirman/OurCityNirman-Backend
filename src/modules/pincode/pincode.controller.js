import axios from 'axios';
import https from 'https';

// Create an https agent to bypass SSL certificate errors
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

/**
 * @desc    Fetch pincode details from api.postalpincode.in
 * @route   GET /api/v1/pincode/:pincode
 * @access  Public
 */
export const getPincodeDetails = async (req, res, next) => {
    try {
        const { pincode } = req.params;
        
        if (!/^\d{6}$/.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid 6-digit pincode'
            });
        }

        const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`, {
            httpsAgent
        });

        // The API returns an array, we send it exactly as expected by the frontend
        res.status(200).json(response.data);
    } catch (error) {
        // Fallback for ECONNRESET or other errors
        console.error('Pincode API Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pincode details. Please try again later.'
        });
    }
};
