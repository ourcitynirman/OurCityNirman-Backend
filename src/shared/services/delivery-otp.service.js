import { OTP } from '../../modules/auth/otp.model.js';
import Order from '../../modules/orders/order.model.js';
import { generateOTP } from "../utils/generator.utils.js";
import { sendMail } from './mail.service.js';
import { ApiError } from "../utils/api.utils.js";
import bcrypt from 'bcryptjs';

/**
 * @desc    Premium Email template for Delivery OTP
 */
const getDeliveryOTPTemplate = (otp, orderNumber, customerName) => `
<body style="margin:0; padding:0; background:#eef1f7; font-family:'Segoe UI', Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 15px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="
          max-width:520px;
          background:#ffffff;
          border-radius:14px;
          overflow:hidden;
          box-shadow:0 12px 40px rgba(0,0,0,0.10);
        ">
          <!-- ===== HEADER / BRAND BANNER ===== -->
          <tr>
            <td style="
              background: linear-gradient(135deg, #1a2a4a 0%, #243b62 100%);
              padding:28px 24px 20px;
              text-align:center;
            ">
              <div style="margin-bottom:6px;">
                <span style="
                  font-size:11px;
                  font-weight:600;
                  letter-spacing:3px;
                  color:#c9a84c;
                  text-transform:uppercase;
                ">Our City</span>
              </div>
              <div style="
                font-size:28px;
                font-weight:800;
                color:#ffffff;
                letter-spacing:1.5px;
                line-height:1.2;
              ">
                NIRMAN <span style="color:#c9a84c;">PVT. LTD.</span>
              </div>
              <div style="
                margin-top:6px;
                font-size:11px;
                color:#a0b4cc;
                letter-spacing:2px;
                text-transform:uppercase;
              ">Building Better Communities</div>
              <div style="
                margin:18px auto 0;
                width:56px;
                height:2px;
                background:linear-gradient(90deg, transparent, #c9a84c, transparent);
                border-radius:2px;
              "></div>
              <h2 style="
                margin:16px 0 4px;
                font-size:19px;
                font-weight:700;
                color:#ffffff;
                letter-spacing:0.5px;
              ">📦 Delivery Confirmation OTP</h2>
              <p style="margin:6px 0 0; font-size:13px; color:#a0b4cc;">
                Order <strong style="color:#e8c96a; font-size:14px;">#${orderNumber}</strong>
              </p>
            </td>
          </tr>
          <!-- ===== BODY ===== -->
          <tr>
            <td style="padding:36px 32px 28px; text-align:center; color:#2d3748;">
              <p style="margin:0 0 4px; font-size:16px; font-weight:700; color:#1a2a4a;">
                Hello, ${customerName} 👋
              </p>
              <p style="margin:0 0 26px; font-size:14px; color:#5a6a80; line-height:1.75;">
                Your order from <strong style="color:#1a2a4a;">Our City Nirman Pvt. Ltd.</strong> is out for delivery!<br/>
                Please share the OTP below with our delivery executive to confirm safe receipt.
              </p>
              <!-- OTP Display Box -->
              <div style="
                display:inline-block;
                margin:0 auto 6px;
                padding:20px 40px;
                background:linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
                border-radius:12px;
                border:2px solid #c9a84c;
                letter-spacing:12px;
                font-size:36px;
                font-weight:900;
                color:#1a2a4a;
                font-family:'Courier New', monospace;
              ">
                ${otp}
              </div>
              <p style="margin:18px 0 0; font-size:13px; color:#718096;">
                ⏱&nbsp; This OTP is valid for <strong style="color:#243b62;">10 minutes</strong> only.
              </p>
              <!-- Warning Banner -->
              <div style="
                margin:18px 0 0;
                padding:12px 16px;
                background:#fff8f0;
                border-radius:8px;
                border-left:4px solid #c9a84c;
                text-align:left;
              ">
                <p style="margin:0; font-size:13px; color:#744210; font-weight:600;">
                  🔒 Security Notice
                </p>
                <p style="margin:6px 0 0; font-size:12px; color:#7d5a36; line-height:1.6;">
                  Our City Nirman Pvt. Ltd. will <u>never</u> ask for this OTP over call, WhatsApp, or email.
                  Share it <strong>only</strong> with the delivery executive physically present at your door.
                </p>
              </div>
            </td>
          </tr>
          <!-- ===== FOOTER ===== -->
          <tr>
            <td style="
              background:#f7f9fc;
              border-top:1px solid #e2e8f0;
              padding:22px 24px;
              text-align:center;
            ">
              <p style="
                margin:0 0 4px;
                font-size:13px;
                font-weight:800;
                color:#1a2a4a;
                letter-spacing:0.8px;
                text-transform:uppercase;
              ">
                Our City Nirman Pvt. Ltd.
              </p>
              <p style="margin:0 0 10px; font-size:11px; color:#b0bec5;">
                © 2026 Our City Nirman Pvt. Ltd. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`;

/**
 * @desc    Generate and send a secure 6-digit delivery OTP to the customer
 * @param   {String} orderId - MongoDB Order ID
 * @returns {Promise<Object>} - Masked email and expiry
 */
export const sendDeliveryOTP = async (orderId) => {
    const order = await Order.findById(orderId).populate('user', 'email fullName');
    if (!order) throw new ApiError(404, 'Order not found');

    const userEmail = order.user.email;
    const customerName = order.user.fullName || 'Customer';
    const otp = generateOTP(6); // 6 digits for delivery
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // 10 minutes expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Store in OTP collection
    await OTP.findOneAndUpdate(
        { email: userEmail, type: 'delivery-confirm', 'metadata.orderId': order._id.toString() },
        {
            otp: hashedOtp,
            expiresAt,
            isUsed: false,
            attempts: 0,
            metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send Email
    await sendMail({
        to: userEmail,
        subject: `Delivery OTP for Order #${order.orderNumber} — Our City Nirman Pvt. Ltd.`,
        html: getDeliveryOTPTemplate(otp, order.orderNumber, customerName)
    });

    return { email: userEmail, orderNumber: order.orderNumber };
};

/**
 * @desc    Verify delivery OTP
 * @param   {String} orderId - MongoDB Order ID
 * @param   {String} inputOtp - User provided OTP
 * @returns {Promise<Boolean>}
 */
export const verifyDeliveryOTP = async (orderId, inputOtp) => {
    const order = await Order.findById(orderId).populate('user', 'email');
    if (!order) throw new ApiError(404, 'Order not found');

    const otpRecord = await OTP.findOne({
        email: order.user.email,
        type: 'delivery-confirm',
        'metadata.orderId': orderId.toString(),
        isUsed: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) throw new ApiError(400, 'OTP not found or expired. Please request a new one.');
    if (new Date() > otpRecord.expiresAt) throw new ApiError(400, 'OTP has expired.');

    if (otpRecord.attempts >= 5) {
        throw new ApiError(429, 'Too many failed attempts. Please request a new OTP.');
    }

    const isMatch = await bcrypt.compare(inputOtp.toString(), otpRecord.otp);

    if (!isMatch) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        const remaining = 5 - otpRecord.attempts;
        throw new ApiError(400, `Invalid OTP. ${remaining} attempt(s) remaining.`);
    }

    // Mark as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    return true;
};
