import bcrypt from 'bcryptjs';
import { OTP } from "../models/otp.model.js";
import { sendMail } from "../services/mail.service.js";
import { generateOTP } from "../utils/generateOtp.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getOTPEmailTemplate = (otp) => `
<body style="margin:0; padding:0; background:#f4f6f8; font-family: Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 15px;">
        <table width="100%" max-width="480" cellpadding="0" cellspacing="0" style="
          max-width:480px;
          background:#ffffff;
          border-radius:12px;
          overflow:hidden;
          box-shadow:0 10px 30px rgba(0,0,0,0.08);
        ">
          <tr>
            <td style="
              background: linear-gradient(135deg, #667eea, #764ba2);
              padding:24px;
              text-align:center;
              color:#ffffff;
            ">
              <h2 style="margin:0; font-size:22px;">Email Verification</h2>
              <p style="margin:8px 0 0; font-size:14px; opacity:0.9;">
                Secure OTP Verification
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:30px; text-align:center; color:#333;">
              <p style="margin:0 0 16px; font-size:15px;">
                Use the following One-Time Password (OTP) to verify your email address.
              </p>
              <div style="
                margin:20px auto;
                padding:14px 24px;
                display:inline-block;
                background:#f0f3ff;
                border-radius:8px;
                letter-spacing:6px;
                font-size:26px;
                font-weight:bold;
                color:#4a56e2;
              ">
                ${otp}
              </div>
              <p style="margin:16px 0 0; font-size:13px; color:#666;">
                This OTP is valid for <strong>5 minutes</strong>.
              </p>
              <p style="margin:12px 0 0; font-size:13px; color:#999;">
                Please do not share this OTP with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="
              background:#f8f9fc;
              padding:16px;
              text-align:center;
              font-size:12px;
              color:#888;
            ">
              © 2026 Your App. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`;

//  Send OTP for email verification 
const sendEmailOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Generate OTP
  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp.toString(), 10);

  // Remove old OTPs
  await OTP.deleteMany({ email: trimmedEmail, type: "email" });

  // Save new OTP
  await OTP.create({
    email: trimmedEmail,
    otp: hashedOtp,
    type: "email",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  // Send email
  await sendMail({
    to: trimmedEmail,
    subject: "Email Verification OTP",
    html: getOTPEmailTemplate(otp),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { email: trimmedEmail }, "OTP sent successfully"));
});

// Verify email OTP (general purpose)
const verifyEmailOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }

  const trimmedEmail = email.trim().toLowerCase();

  const record = await OTP.findOne({
    email: trimmedEmail,
    type: "email",
    isUsed: false,
  }).sort({ createdAt: -1 });

  if (!record) {
    throw new ApiError(400, "OTP not found or already used");
  }

  // Expiry check
  if (record.expiresAt < Date.now()) {
    throw new ApiError(400, "OTP expired");
  }

  // Attempt limit
  if (record.attempts >= 5) {
    throw new ApiError(429, "Too many incorrect attempts");
  }

  const isValid = await bcrypt.compare(otp.toString(), record.otp);

  if (!isValid) {
    record.attempts += 1;
    await record.save();

    throw new ApiError(
      400,
      `Invalid OTP. ${5 - record.attempts} attempts remaining.`
    );
  }

  // Mark OTP as used
  record.isUsed = true;
  await record.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "OTP verified successfully"));
});

//  Resend email OTP (general purpose)
const resendEmailOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Check last OTP for cooldown
  const lastOtp = await OTP.findOne({
    email: trimmedEmail,
    type: "email",
    isUsed: false,
  }).sort({ createdAt: -1 });

  // Cooldown check (30 seconds)
  if (lastOtp) {
    const timeSinceLastOtp = Date.now() - lastOtp.createdAt.getTime();
    if (timeSinceLastOtp < 30 * 1000) {
      const waitTime = Math.ceil((30 * 1000 - timeSinceLastOtp) / 1000);
      throw new ApiError(
        429,
        `Please wait ${waitTime} seconds before requesting a new OTP`
      );
    }
  }

  // Generate new OTP
  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp.toString(), 10);

  // Remove old OTPs
  await OTP.deleteMany({ email: trimmedEmail, type: "email" });

  // Save new OTP
  await OTP.create({
    email: trimmedEmail,
    otp: hashedOtp,
    type: "email",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  // Send email
  await sendMail({
    to: trimmedEmail,
    subject: "Email Verification OTP",
    html: getOTPEmailTemplate(otp),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { email: trimmedEmail }, "OTP resent successfully"));
});

export { sendEmailOTP, verifyEmailOTP, resendEmailOTP };