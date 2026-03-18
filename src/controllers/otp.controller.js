import bcrypt from "bcrypt";
import { OTP } from "../models/otp.model.js";
import { sendMail } from "../services/mail.service.js";
import { generateOTP } from "../utils/generateOtp.js";

const sendOTPBeforeRegistration = async (email) => {
  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp.toString(), 10);


  await OTP.deleteMany({ email, type: "email" });

  
  await OTP.create({
    email,
    otp: hashedOtp,
    type: "email",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });


  await sendMail({
    to: email,
    subject: "Email Verification OTP",
    html: getOTPEmailTemplate(otp),
  });
};


const sendEmailOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  try {
    await sendOTPBeforeRegistration(email);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

//  Verify OTP
const verifyEmailOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required",
    });
  }

  const record = await OTP.findOne({
    email,
    type: "email",
    isUsed: false,
  }).sort({ createdAt: -1 });

  if (!record) {
    return res.status(400).json({
      success: false,
      message: "OTP not found or already used",
    });
  }

  
  if (record.expiresAt < Date.now()) {
    return res.status(400).json({
      success: false,
      message: "OTP expired",
    });
  }

  
  if (record.attempts >= 5) {
    return res.status(429).json({
      success: false,
      message: "Too many incorrect attempts",
    });
  }

  const isValid = await bcrypt.compare(otp.toString(), record.otp);

  if (!isValid) {
    record.attempts += 1;
    await record.save();

    return res.status(400).json({
      success: false,
      message: "Invalid OTP",
    });
  }

  
  record.isUsed = true;
  await record.save();

  
  res.status(200).json({
    success: true,
    message: "OTP verified successfully",
  });
};


const resendEmailOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required for OTP resend",
    });
  }


  const lastOtp = await OTP.findOne({
    email,
    type: "email",
    isUsed: false,
  }).sort({ createdAt: -1 });

  
  if (lastOtp) {
    const diff = Date.now() - lastOtp.createdAt.getTime();
    if (diff < 30 * 1000) {
      return res.status(429).json({
        success: false,
        message: `Please wait 30 seconds before requesting OTP again`,
      });
    }
  }

  try {
    await sendOTPBeforeRegistration(email);

    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
};


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

export {
  sendEmailOTP,
  verifyEmailOTP,
  resendEmailOTP,
  sendOTPBeforeRegistration,
};


