import bcrypt from 'bcryptjs'
import { OTP } from '../../modules/auth/otp.model.js';
import { sendMail } from './mail.service.js';
import { generateOTP } from '../utils/generateOtp.js';
import Order from '../../modules/orders/order.model.js';
import ApiError from '../utils/ApiError.js';



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

              <!-- Gold accent bar -->
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
              <p style="margin:0 0 4px; font-size:11px; color:#a0aec0;">
                Registered under the Companies Act, 2013 &nbsp;|&nbsp; India
              </p>
              <p style="margin:0 0 10px; font-size:11px; color:#b0bec5;">
                CIN: U45200XX2020PTC000000
              </p>
              <div style="width:32px; height:1px; background:#e2e8f0; margin:0 auto 10px;"></div>
              <p style="margin:0; font-size:11px; color:#b0bec5; line-height:1.6;">
                © 2026 Our City Nirman Pvt. Ltd. All rights reserved.<br/>
                <span style="font-size:10px; color:#c8d0dc;">
                  This is a system-generated email. Please do not reply to this message.
                </span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
`;



export async function sendDeliveryOTP(orderId) {
  // Order  user populate
  const order = await Order.findById(orderId).populate('user', 'email fullName');
  if (!order) throw new ApiError(404, 'Order not found');

  if (order.status !== 'shipped') {
    throw new ApiError(400, 'OTP can only be sent for orders that are in "shipped" status');
  }

  const customerEmail = order.user?.email;
  const customerName = order.user?.fullName || 'Customer';

  if (!customerEmail) {
    throw new ApiError(400, 'Customer email not found for this order');
  }

  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp.toString(), 10);

  await OTP.deleteMany({
    email: customerEmail,
    type: 'delivery-confirm',
    'metadata.orderId': orderId.toString(),
    isUsed: false,
  });

  //  OTP 10 min expiry
  await OTP.create({
    email: customerEmail,
    otp: hashedOtp,
    type: 'delivery-confirm',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    metadata: { orderId: orderId.toString() },
  });

  await sendMail({
    to: customerEmail,
    subject: `Delivery OTP for Order #${order.orderNumber} — Our City Nirman Pvt. Ltd.`,
    html: getDeliveryOTPTemplate(otp, order.orderNumber, customerName),
  });

  return { email: customerEmail, orderNumber: order.orderNumber };
}



export async function verifyDeliveryOTP(orderId, otp) {

  const order = await Order.findById(orderId).populate('user', 'email');
  if (!order) throw new ApiError(404, 'Order not found');

  const customerEmail = order.user?.email;
  if (!customerEmail) throw new ApiError(400, 'Customer email not found');


  const record = await OTP.findOne({
    email: customerEmail,
    type: 'delivery-confirm',
    isUsed: false,
    'metadata.orderId': orderId.toString(),
  }).sort({ createdAt: -1 });

  if (!record) {
    throw new ApiError(400, 'OTP not found or already used. Please request a new OTP.');
  }


  if (record.expiresAt < new Date()) {
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }


  if (record.attempts >= 5) {
    throw new ApiError(429, 'Too many incorrect attempts. Please request a new OTP.');
  }


  const isValid = await bcrypt.compare(otp.toString(), record.otp);

  if (!isValid) {
    record.attempts += 1;
    await record.save();
    const remaining = 5 - record.attempts;
    throw new ApiError(400, `Invalid OTP. ${remaining} attempt(s) remaining.`);
  }


  record.isUsed = true;
  await record.save();

  return true;
}