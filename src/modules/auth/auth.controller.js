
import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";

import { User } from "./user.model.js";

import bcrypt from 'bcryptjs';
import { OTP } from "./otp.model.js";
import { sendMail } from "../../shared/services/mail.service.js";
import { generateOTP } from "../../shared/utils/generator.utils.js";
import jwt from "jsonwebtoken";
import { ALL_ROLES, ROLES } from "../../shared/constants/roles.js";

import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";

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
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>OTP Verification – Our City Nirman</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    /* Reset */
    * { box-sizing: border-box; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
 
    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .dark-bg   { background-color: #1a1a1a !important; }
      .dark-card { background-color: #2a2a2a !important; }
      .dark-text { color: #e5e7eb !important; }
      .dark-muted{ color: #9ca3af !important; }
      .dark-footer{ background-color: #1f1f1f !important; }
    }
 
    /* Mobile responsive */
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
 
  <!-- Preheader (hidden preview text) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    Your OTP for Our City Nirman registration: ${otp} — valid for 5 minutes.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
 
  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fff7ed;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
 
        <!-- Email card -->
        <table class="email-container dark-card" role="presentation" cellpadding="0" cellspacing="0" border="0"
          width="520" style="
            max-width: 520px;
            width: 100%;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid #fed7aa;
          ">
 
          <!-- ── HEADER ── -->
          <tr>
            <td class="header-cell" align="center" style="
              background-color: #ea580c;
              padding: 28px 32px;
            ">
              <!--[if mso]>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center">
              <![endif]-->
              <p class="company-name" style="
                margin: 0 0 4px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 20px;
                font-weight: 700;
                color: #ffffff;
                letter-spacing: 0.3px;
              ">Our City Nirman Pvt. Ltd.</p>
              <p style="
                margin: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 13px;
                color: rgba(255,255,255,0.88);
              ">Building Better Cities Together</p>
              <!--[if mso]></td></tr></table><![endif]-->
            </td>
          </tr>
 
          <!-- Orange accent bar -->
          <tr>
            <td height="4" style="background-color: #fb923c; font-size:0; line-height:0;">&nbsp;</td>
          </tr>
 
          <!-- ── BODY ── -->
          <tr>
            <td class="email-body-cell dark-card" align="center" style="padding: 36px 40px 32px; background-color: #ffffff;">
 
              <!-- Lock icon (pure HTML/CSS — no image dependency) -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td align="center" style="
                    width: 60px;
                    height: 60px;
                    background-color: #fff7ed;
                    border: 2px solid #fed7aa;
                    border-radius: 50%;
                    font-size: 26px;
                    line-height: 60px;
                    text-align: center;
                  ">&#128274;</td>
                </tr>
              </table>
 
              <!-- Heading -->
              <h1 style="
                margin: 0 0 8px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 22px;
                font-weight: 700;
                color: #9a3412;
                text-align: center;
              ">Verify Your Email</h1>
 
              <p style="
                margin: 0 0 6px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 15px;
                color: #374151;
                text-align: center;
              ">Hello <strong>${fullName}</strong>,</p>
 
              <p style="
                margin: 0 0 28px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 15px;
                color: #6b7280;
                text-align: center;
                line-height: 1.7;
              ">
                Use the OTP below to complete your
                <strong style="color:#ea580c;">Our City Nirman</strong>
                account registration.
              </p>
 
              <!-- ── OTP BOX ── -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 12px;">
                <tr>
                  <td class="otp-box" align="center" style="
                    background-color: #fff7ed;
                    border: 2px solid #fb923c;
                    border-radius: 12px;
                    padding: 18px 32px;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 32px;
                    font-weight: 700;
                    letter-spacing: 10px;
                    color: #ea580c;
                    text-align: center;
                  ">${otp}</td>
                </tr>
              </table>
 
              <!-- Expiry -->
              <p style="
                margin: 0 0 6px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 13px;
                color: #f97316;
                font-weight: 500;
                text-align: center;
              ">&#9201; Valid for <strong>5 minutes only</strong></p>
 
              <!-- Warning box -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
                <tr>
                  <td style="
                    background-color: #fff7ed;
                    border: 1px solid #fed7aa;
                    border-left: 4px solid #f97316;
                    border-radius: 8px;
                    padding: 14px 16px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                    font-size: 13px;
                    color: #9a3412;
                    line-height: 1.6;
                    text-align: left;
                  ">
                    &#9888;&#65039; <strong>Never share this OTP</strong> with anyone, including Our City Nirman staff.
                    If you did not request this, please ignore this email.
                  </td>
                </tr>
              </table>
 
            </td>
          </tr>
 
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td height="1" style="background-color: #ffedd5; font-size:0; line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
 
          <!-- ── FOOTER ── -->
          <tr>
            <td class="dark-footer" align="center" style="
              background-color: #fff7ed;
              padding: 18px 32px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              font-size: 12px;
              color: #a16207;
              line-height: 1.7;
            ">
              <p style="margin: 0 0 3px;">
                &copy; 2026 <strong>Our City Nirman Pvt. Ltd.</strong> &middot; All rights reserved
              </p>
              <p style="margin: 0; color: #d97706;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>
 
        </table>
        <!-- /Email card -->
 
      </td>
    </tr>
  </table>
 
</body>
</html>
`;
const getPasswordResetEmailTemplate = (resetLink, fullName) => `
<body style="margin:0; padding:0; background:#fff7ed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 12px 40px rgba(234,88,12,0.12);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#ea580c,#f97316); padding:30px 24px; text-align:center;">
              <h1 style="margin:0 0 5px; font-size:21px; font-weight:700; color:#ffffff; letter-spacing:0.4px;">Our City Nirman Pvt. Ltd.</h1>
              <p style="margin:0; font-size:13px; color:rgba(255,255,255,0.88);">Building Better Cities Together</p>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr><td style="height:4px; background:linear-gradient(90deg,#fed7aa,#f97316,#fed7aa);"></td></tr>

          <!-- Icon -->
          <tr>
            <td style="text-align:center; padding:32px 24px 0;">
              <div style="display:inline-block; background:#fff7ed; border:2px solid #fed7aa; border-radius:50%; width:60px; height:60px; line-height:60px; font-size:28px; text-align:center;">🔐</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 36px 36px; text-align:center; color:#1f2937;">
              <h2 style="margin:16px 0 8px; font-size:23px; font-weight:700; color:#9a3412;">Reset Your Password</h2>
              <p style="margin:0 0 8px; font-size:15px; color:#374151;">Hello <strong>${fullName}</strong>,</p>
              <p style="margin:0 0 30px; font-size:15px; color:#6b7280; line-height:1.7;">
                We received a request to reset the password for your
                <strong style="color:#ea580c;">Our City Nirman</strong> account.
                Click the button below to set a new password.
              </p>

              <!-- Button -->
              <a href="${resetLink}" target="_blank" style="display:inline-block; background:linear-gradient(135deg,#ea580c,#f97316); color:#ffffff; text-decoration:none; padding:15px 40px; border-radius:8px; font-size:15px; font-weight:600; letter-spacing:0.4px; box-shadow:0 4px 14px rgba(234,88,12,0.45);">
                Reset My Password
              </a>

              <p style="margin:18px 0 0; font-size:13px; color:#f97316; font-weight:500;">
                ⏱ This link is valid for <strong>15 minutes only</strong>
              </p>

             

              <!-- Warning -->
              <div style="margin:28px 0 0; padding:14px 18px; background:#fff7ed; border:1px solid #fed7aa; border-left:4px solid #f97316; border-radius:8px; text-align:left;">
                <p style="margin:0; font-size:13px; color:#9a3412; line-height:1.6;">
                  ⚠️ <strong>Didn't request this?</strong>
                  If you did not request a password reset, simply ignore this email — your password will remain unchanged.
                </p>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 36px;"><hr style="border:none; border-top:1px solid #ffedd5; margin:0;" /></td></tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fff7ed; padding:20px 24px; text-align:center; font-size:12px; color:#a16207; line-height:1.7;">
              <p style="margin:0 0 3px;">© 2026 <strong>Our City Nirman Pvt. Ltd.</strong> · All rights reserved</p>
              <p style="margin:0; color:#d97706;">This is an automated email. Please do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
`;

//  Step 1: Validate registration data and send OTP
/**
 * @desc    Register a new user (initiates OTP verification)
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
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


  // All roles except admin are allowed to self-register
  const allowedRoles = ALL_ROLES.filter(r => r !== ROLES.ADMIN);
  if (!allowedRoles.includes(role)) {
    throw new ApiError(
      400,
      `Invalid role. Must be one of: ${allowedRoles.join(', ')}`
    );
  }


  if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
    throw new ApiError(400, "Invalid mobile number");
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
  
  // Also hash the password before storing in metadata for security
  const hashedPasswordForMetadata = await bcrypt.hash(password, 10);


  await OTP.deleteMany({ email: trimmedEmail, type: "registration" });


  await OTP.create({
    email: trimmedEmail,
    otp: hashedOtp,
    type: "registration",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    metadata: {
      fullName: trimmedFullName,
      phone: trimmedPhone,
      password: hashedPasswordForMetadata,
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
/**
 * @desc    Verify registration OTP and create account
 * @route   POST /api/v1/auth/verify
 * @access  Public
 */
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
/**
 * @desc    Resend registration OTP
 * @route   POST /api/v1/auth/resend
 * @access  Public
 */
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
/**
 * @desc    Login user and issue tokens
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
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
    throw new ApiError(401, "Invalid credentials (password)");
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
  // console.log(loggedInUser);  // Removed for production

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
/**
 * @desc    Logout user and clear tokens
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: 1 },
    },
    { returnDocument: 'after' }
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

/**
 * @desc    Refresh access token using refresh token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
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

    const user = await User.findById(decoded._id).select("+refreshToken");

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

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


/**
 * @desc    Get details of currently logged-in user
 * @route   GET /api/v1/auth/current-user
 * @access  Private
 */
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
/**
 * @desc    Change password for logged-in user
 * @route   POST /api/v1/auth/change-password
 * @access  Private
 */
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
/**
 * @desc    Initiate forgot password process (sends reset link)
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
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
await sendMail({
  to: user.email,
  subject: "Reset Your Password – Our City Nirman",
  html: getPasswordResetEmailTemplate(resetLink, user.fullName),
});

  return res.status(200).json(
    new ApiResponse(200, {}, "Password reset link sent to email")
  );
});

//reset password
/**
 * @desc    Reset password using token from email
 * @route   POST /api/v1/auth/reset-password/:token
 * @access  Public
 */
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



/**
 * @desc    Update user profile details and avatar
 * @route   PATCH /api/v1/auth/update-profile
 * @access  Private
 */
const updateUserProfile = asyncHandler(async (req, res) => {
  const { fullName, phone } = req.body;
  const updates = {};

  if (fullName) updates.fullName = fullName.trim();
  if (phone) {
    const trimmedPhone = phone.trim();
    if (!/^[0-9]{10}$/.test(trimmedPhone)) {
      throw new ApiError(400, "Phone number must be exactly 10 digits");
    }
    const existing = await User.findOne({ phone: trimmedPhone, _id: { $ne: req.user._id } });
    if (existing) throw new ApiError(409, "Phone number already in use by another account");
    updates.phone = trimmedPhone;
  }

  if (req.file) {
    const uploadResult = await uploadOnCloudinary(req.file.path, true);
    if (!uploadResult || !uploadResult.success) {
      throw new ApiError(500, "Failed to upload image. Try again.");
    }
    updates.profileImage = uploadResult.url;

    if (req.user.profileImage && req.user.profileImage.includes("cloudinary.com")) {
      try {
        const urlParts = req.user.profileImage.split("/");
        const filename = urlParts[urlParts.length - 1];
        const publicId = filename.split(".")[0];
        await deleteFromCloudinary(publicId, true);
      } catch (err) {
        console.warn("Could not delete old profile image:", err.message);
      }
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { returnDocument: 'after', runValidators: true }
  ).select("-password -refreshToken");

  if (!user) throw new ApiError(404, "User not found");

  return res.status(200).json(new ApiResponse(200, user, "Profile updated successfully"));
});

export {
  generateAccessAndRefreshTokens,
  getOTPEmailTemplate,
  getPasswordResetEmailTemplate,
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
  updateUserProfile,
};