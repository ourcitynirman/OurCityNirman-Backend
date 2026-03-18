
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

import { User } from "../models/user.model.js";

import bcrypt from "bcrypt";
import { OTP } from "../models/otp.model.js";
import { sendMail } from "../services/mail.service.js";
import { generateOTP } from "../utils/generateOtp.js";
import jwt from "jsonwebtoken";
import sendEmail from "../utils/sendEmail.js";

//  Generate Access and Refresh Tokens


const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Save refresh token to database
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Token generation failed");
  }
};
//  Email template helper
const getOTPEmailTemplate = (otp, fullName) => `
<body style="margin:0; padding:0; background:#f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="
          max-width:480px;
          background:#ffffff;
          border-radius:14px;
          overflow:hidden;
          box-shadow:0 12px 32px rgba(0,0,0,0.08);
          position:relative;
        ">

          <!-- Header -->
          <tr>
            <td style="
              background: linear-gradient(135deg, #4f46e5, #6366f1);
              padding:24px;
              text-align:center;
            ">
              
              <h2 style="
                margin:0;
                font-size:22px;
                color:#ffffff;
                font-weight:600;
              ">
                Verify Your Email
              </h2>
              <p style="
                margin:6px 0 0;
                font-size:14px;
                color:rgba(255,255,255,0.9);
              ">
                Secure one-time verification code
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="
              padding:32px 28px;
              text-align:center;
              color:#1f2937;
              position:relative;
            ">

              <!-- Watermark -->
              <div style="
                position:absolute;
                top:50%;
                left:50%;
                transform:translate(-50%,-50%);
                font-size:72px;
                font-weight:700;
                color:#f1f5f9;
                opacity:0.35;
                pointer-events:none;
                white-space:nowrap;
              ">
                CityNest
              </div>

              <p style="margin:0 0 10px; font-size:15px;">
                Hello <strong>${fullName}</strong>,
              </p>

              <p style="margin:0 0 22px; font-size:15px; color:#374151;">
                Use the OTP below to complete your registration.
              </p>

              <!-- OTP Box -->
              <div style="
                margin:0 auto 16px;
                padding:16px 28px;
                display:inline-block;
                background:#eef2ff;
                border-radius:10px;
                letter-spacing:8px;
                font-size:28px;
                font-weight:700;
                color:#4f46e5;
              ">
                ${otp}
              </div>

              <p style="margin:0; font-size:13px; color:#6b7280;">
                This code is valid for <strong>5 minutes</strong>
              </p>

              <p style="margin:14px 0 0; font-size:13px; color:#9ca3af;">
                Never share this OTP with anyone.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              background:#f9fafb;
              padding:16px;
              text-align:center;
              font-size:12px;
              color:#9ca3af;
            ">
              © 2026 CityNest · All rights reserved
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>

`;

//  Step 1: Validate registration data and send OTP
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, role } = req.body;

  
  if (!fullName || !email || !phone || !password || !role) {
    throw new ApiError(400, "All fields are required");
  }

  
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();
  const trimmedFullName = fullName.trim();

  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new ApiError(400, "Invalid email format");
  }

  
  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }


  const allowedRoles = ["user", "vendor", "homeowner", "labour"];
  if (!allowedRoles.includes(role)) {
    throw new ApiError(
      400,
      "Invalid role. Must be user, vendor, homeowner or labour"
    );
  }

  
  if (!/^[0-9]{10}$/.test(trimmedPhone)) {
    throw new ApiError(400, "Phone number must be 10 digits");
  }

  

  const existingUser = await User.findOne({
    $or: [{ email: trimmedEmail }, { phone: trimmedPhone }],
  });

  if (existingUser) {
    if (existingUser.email === trimmedEmail) {
      throw new ApiError(409, "User with this email already exists");
    }
    if (existingUser.phone === trimmedPhone) {
      throw new ApiError(409, "User with this phone already exists");
    }
  }

  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp.toString(), 10);


  await OTP.deleteMany({ email: trimmedEmail, type: "registration" });

  
  await OTP.create({
    email: trimmedEmail,
    otp: hashedOtp,
    type: "registration",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), 
    metadata: {
      fullName: trimmedFullName,
      phone: trimmedPhone,
      password,
      role,
    },
  });

  
  await sendMail({
    to: trimmedEmail,
    subject: "Complete Your Registration - OTP Verification",
    html: getOTPEmailTemplate(otp, trimmedFullName),
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { email: trimmedEmail },
      "OTP sent to your email. Please verify to complete registration."
    )
  );
});

//   Verify OTP and create account
const verifyRegistrationOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  // Validation
  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Find OTP record
  const otpRecord = await OTP.findOne({
    email: trimmedEmail,
    type: "registration",
    isUsed: false,
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new ApiError(400, "OTP not found or already used. Please request a new OTP.");
  }

  // Check expiry
  if (otpRecord.expiresAt < Date.now()) {
    throw new ApiError(400, "OTP expired. Please request a new one.");
  }

  // Check attempt limit
  if (otpRecord.attempts >= 5) {
    throw new ApiError(429, "Too many incorrect attempts. Please request a new OTP.");
  }

  // Verify OTP
  const isValid = await bcrypt.compare(otp.toString(), otpRecord.otp);

  if (!isValid) {
    otpRecord.attempts += 1;
    await otpRecord.save();

    throw new ApiError(
      400,
      `Invalid OTP. ${5 - otpRecord.attempts} attempts remaining.`
    );
  }

  const { fullName, phone, password, role } = otpRecord.metadata;

  const existingUser = await User.findOne({
    $or: [{ email: trimmedEmail }, { phone }],
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists with this email or phone");
  }

  const user = await User.create({
    fullName,
    email: trimmedEmail,
    phone,
    password, 
    role,
    isActive: true,
    isVerified: true, 
  });

  // Mark OTP as used
  otpRecord.isUsed = true;
  await otpRecord.save();

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "User registration failed");
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      createdUser,
      "Registration successful! Your account has been created."
    )
  );
});

//  Resend Registration OTP
const resendRegistrationOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Find the last OTP record
  const lastOtp = await OTP.findOne({
    email: trimmedEmail,
    type: "registration",
    isUsed: false,
  }).sort({ createdAt: -1 });

  if (!lastOtp) {
    throw new ApiError(
      400,
      "No pending registration found. Please start registration again."
    );
  }

  // Cooldown check 
  const timeSinceLastOtp = Date.now() - lastOtp.createdAt.getTime();
  if (timeSinceLastOtp < 30 * 1000) {
    const waitTime = Math.ceil((30 * 1000 - timeSinceLastOtp) / 1000);
    throw new ApiError(
      429,
      `Please wait ${waitTime} seconds before requesting a new OTP`
    );
  }

  // Generate new OTP
  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp.toString(), 10);

  // Remove old OTPs
  await OTP.deleteMany({ email: trimmedEmail, type: "registration" });

  // Create new OTP with same metadata
  await OTP.create({
    email: trimmedEmail,
    otp: hashedOtp,
    type: "registration",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    metadata: lastOtp.metadata,
  });

  // Send OTP email
  await sendMail({
    to: trimmedEmail,
    subject: "Complete Your Registration - OTP Verification",
    html: getOTPEmailTemplate(otp, lastOtp.metadata.fullName),
  });

  return res.status(200).json(
    new ApiResponse(200, { email: trimmedEmail }, "OTP resent successfully")
  );
});

//  Login user with email/phone and password
const loginUser = asyncHandler(async (req, res) => {
  const { email, phone, password } = req.body;

  
  const trimmedEmail = email?.trim().toLowerCase();
  const trimmedPhone = phone?.trim();


  if (!trimmedEmail && !trimmedPhone) {
    throw new ApiError(400, "Email or phone number is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const query = {};
  if (trimmedEmail) {
    query.email = trimmedEmail;
  } else if (trimmedPhone) {
    query.phone = trimmedPhone;
  }

  const user = await User.findOne(query).select("+password");
 
 
  if (!user) {
    throw new ApiError(401, "Invalid credentials user");
  }

  
  if (!user.isVerified) {
    throw new ApiError(403, "Please verify your email before logging in");
  }

  // 5️ Check if account is active
  if (!user.isActive) {
    throw new ApiError(403, "Your account has been deactivated. Please contact support.");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials pasword");
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

 
  user.lastLogin = new Date();
  user.save({ validateBeforeSave: false }).catch((err) =>
    console.error("Failed to update last login:", err)
  );

 
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  console.log(loggedInUser)

  if (!loggedInUser) {
    throw new ApiError(500, "Login failed. Please try again.");
  }
  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const refreshTokenCookieOptions = {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, refreshTokenCookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "Login successful"
      )
    );
});

// Logout user
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: 1 },
    },
    { new: true }
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  };

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, null, "Logout successful"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  try {
    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decoded._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    const cookieOptions = {
      httpOnly: true,
      secure: false,    
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };

    const refreshTokenCookieOptions = {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", newRefreshToken, refreshTokenCookieOptions)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});


const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(200, req.user, "User details fetched successfully")
    );
});

const logoutAllDevices = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await User.findByIdAndUpdate(userId, {
    $unset: { refreshToken: 1 },
    $inc: { tokenVersion: 1 } 
  });


  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/"
  };

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Logged out from all devices"));
});

//change password
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old and new password are required");
  }

  if (newPassword.length < 4) {
    throw new ApiError(400, "New password must be at least 4 characters");
  }

  const user = await User.findById(req.user._id).select("+password");

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});


//forgot password 
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User not found with this email");
  }

  // create reset token
  const resetToken = jwt.sign(
    { _id: user._id },
    process.env.RESET_PASSWORD_SECRET,
    { expiresIn: "15m" }
  );

  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  // send email 
  await sendEmail({
    to: user.email,
    subject: "Reset Your Password",
    html: `
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>This link is valid for 15 minutes.</p>
    `,
  });

  return res.status(200).json(
    new ApiResponse(200, {}, "Password reset link sent to email")
  );
});

//reset password
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword, confirmPassword } = req.body;

  if (!newPassword || !confirmPassword) {
    throw new ApiError(400, "All fields are required");
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "Passwords do not match");
  }

  if (newPassword.length < 4) {
    throw new ApiError(400, "Password must be at least 4 characters");
  }

  // verify token
  const decoded = jwt.verify(token, process.env.RESET_PASSWORD_SECRET);

  const user = await User.findById(decoded._id).select("+password");

  if (!user) {
    throw new ApiError(400, "Invalid or expired token");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(200, {}, "Password reset successfully")
  );
});



export {
  generateAccessAndRefreshTokens,
  getOTPEmailTemplate,
  registerUser,
  verifyRegistrationOTP,
  resendRegistrationOTP,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getCurrentUser,
  changePassword,
  logoutAllDevices,
  forgotPassword,
  resetPassword,

};