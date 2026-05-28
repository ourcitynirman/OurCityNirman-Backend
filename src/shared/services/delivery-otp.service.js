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
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Delivery Verification OTP – Our City Nirman</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    * { box-sizing: border-box; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
 
    @media (prefers-color-scheme: dark) {
      .dark-bg   { background-color: #1a1a1a !important; }
      .dark-card { background-color: #2a2a2a !important; }
      .dark-text { color: #e5e7eb !important; }
      .dark-muted{ color: #9ca3af !important; }
      .dark-footer{ background-color: #1f1f1f !important; }
    }
 
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-body-cell { padding: 24px 16px !important; }
      .otp-box { font-size: 24px !important; letter-spacing: 6px !important; padding: 14px 20px !important; }
      .header-cell { padding: 24px 16px !important; }
      .company-name { font-size: 18px !important; }
    }
  </style>
</head>
<body class="dark-bg" style="margin:0; padding:0; background-color:#fff7ed; width:100%;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    Your OTP to verify delivery of order #${orderNumber} is ${otp}.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fff7ed;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table class="email-container dark-card" role="presentation" cellpadding="0" cellspacing="0" border="0"
          width="520" style="max-width: 520px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #fed7aa; box-shadow:0 12px 40px rgba(234,88,12,0.12);">
          <tr>
            <td class="header-cell" align="center" style="background-color: #ea580c; padding: 28px 32px;">
              <p class="company-name" style="margin: 0 0 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.3px;">Our City Nirman Pvt. Ltd.</p>
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 13px; color: rgba(255,255,255,0.88);">Building Better Cities Together</p>
            </td>
          </tr>
          <tr><td height="4" style="background-color: #fb923c; font-size:0; line-height:0;">&nbsp;</td></tr>
          <tr>
            <td class="email-body-cell dark-card" align="center" style="padding: 36px 40px 32px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td align="center" style="width: 60px; height: 60px; background-color: #fff7ed; border: 2px solid #fed7aa; border-radius: 50%; font-size: 26px; line-height: 60px; text-align: center;">📦</td>
                </tr>
              </table>
              <h1 style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 22px; font-weight: 700; color: #9a3412; text-align: center;">Delivery Confirmation OTP</h1>
              <p style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 15px; color: #374151; text-align: center;">Hello <strong>${customerName}</strong> 👋,</p>
              
              <p style="margin: 0 0 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 15px; color: #6b7280; text-align: center; line-height: 1.7;">
                Your order <strong style="color: #ea580c;">#${orderNumber}</strong> is out for delivery!<br/>
                Please share the OTP below with our delivery executive to verify and confirm safe receipt.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 12px;">
                <tr>
                  <td class="otp-box" align="center" style="background-color: #fff7ed; border: 2px solid #fb923c; border-radius: 12px; padding: 18px 32px; font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 10px; color: #ea580c; text-align: center;">${otp}</td>
                </tr>
              </table>
              <p style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 13px; color: #f97316; font-weight: 500; text-align: center;">&#9201; Valid for <strong>10 minutes only</strong></p>
              
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
                <tr>
                  <td style="background-color: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid #f97316; border-radius: 8px; padding: 14px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 13px; color: #9a3412; line-height: 1.6; text-align: left;">
                    🔒 <strong>Security Notice:</strong> Our City Nirman Pvt. Ltd. will never ask for this OTP over a call, WhatsApp, or SMS. Share this code <strong>only</strong> with the delivery agent physically present at your door.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding: 0 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="1" style="background-color: #ffedd5; font-size:0; line-height:0;">&nbsp;</td></tr></table></td></tr>
          <tr>
            <td class="dark-footer" align="center" style="background-color: #fff7ed; padding: 18px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12px; color: #a16207; line-height: 1.7;">
              <p style="margin: 0 0 3px;">&copy; 2026 <strong>Our City Nirman Pvt. Ltd.</strong> &middot; All rights reserved</p>
              <p style="margin: 0; color: #d97706;">This is an automated email. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
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
