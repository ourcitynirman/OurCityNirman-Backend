import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";
import AuthService from "./auth.service.js";
import { 
    registerSchema, 
    verifyOTPSchema, 
    resendOTPSchema, 
    loginSchema, 
    changePasswordSchema, 
    forgotPasswordSchema, 
    resetPasswordSchema, 
    updateProfileSchema 
} from "./auth.validation.js";

const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction || process.env.PROTOCOL === 'https', // Force secure if on https
        sameSite: "lax", // 'lax' is more reliable than 'strict' for many production deployments
        path: "/",
    };
};

/**
 * @desc    Register a new user (initiates OTP verification)
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
    const validatedData = registerSchema.parse(req.body);
    const result = await AuthService.registerUser(validatedData);

    return res.status(200).json(
        new ApiResponse(200, result, "OTP sent to your email. Please verify to complete registration.")
    );
});

/**
 * @desc    Verify registration OTP and create account
 * @route   POST /api/v1/auth/verify
 * @access  Public
 */
export const verifyRegistrationOTP = asyncHandler(async (req, res) => {
    const { email, otp } = verifyOTPSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await AuthService.verifyRegistrationOTP(email, otp);

    const cookieOptions = getCookieOptions();

    return res
        .status(201)
        .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
        .cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 })
        .json(new ApiResponse(201, { user, accessToken, refreshToken }, "Registration successful! You are now logged in."));
});

/**
 * @desc    Resend registration OTP
 * @route   POST /api/v1/auth/resend
 * @access  Public
 */
export const resendRegistrationOTP = asyncHandler(async (req, res) => {
    const { email } = resendOTPSchema.parse(req.body);
    const result = await AuthService.resendRegistrationOTP(email);

    return res.status(200).json(
        new ApiResponse(200, result, "OTP resent successfully")
    );
});

/**
 * @desc    Login user and issue tokens
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const loginUser = asyncHandler(async (req, res) => {
    const validatedData = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await AuthService.loginUser(validatedData);

    const cookieOptions = getCookieOptions();

    return res
        .status(200)
        .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
        .cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 })
        .json(new ApiResponse(200, { user, accessToken, refreshToken }, "Login successful"));
});

/**
 * @desc    Logout user and clear tokens
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export const logoutUser = asyncHandler(async (req, res) => {
    await AuthService.logoutUser(req.user._id);

    const cookieOptions = getCookieOptions();

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
export const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    const { accessToken, refreshToken: newRefreshToken } = await AuthService.refreshAccessToken(incomingRefreshToken);

    const cookieOptions = getCookieOptions();

    return res
        .status(200)
        .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
        .cookie("refreshToken", newRefreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 })
        .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed successfully"));
});

/**
 * @desc    Get details of currently logged-in user
 * @route   GET /api/v1/auth/current-user
 * @access  Private
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "User details fetched successfully"));
});

/**
 * @desc    Logout from all devices
 * @route   POST /api/v1/auth/logout-all
 * @access  Private
 */
export const logoutAllDevices = asyncHandler(async (req, res) => {
    await AuthService.logoutAllDevices(req.user._id);

    const cookieOptions = getCookieOptions();

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "Logged out from all devices"));
});

/**
 * @desc    Change password for logged-in user
 * @route   POST /api/v1/auth/change-password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);
    await AuthService.changePassword(req.user._id, oldPassword, newPassword);

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});

/**
 * @desc    Initiate forgot password process (sends reset link)
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    await AuthService.forgotPassword(email);

    return res.status(200).json(new ApiResponse(200, {}, "Password reset link sent to email"));
});

/**
 * @desc    Reset password using token from email
 * @route   POST /api/v1/auth/reset-password/:token
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res) => {
    const { newPassword } = resetPasswordSchema.parse(req.body);
    await AuthService.resetPassword(req.params.token, newPassword);

    return res.status(200).json(new ApiResponse(200, {}, "Password reset successfully"));
});

/**
 * @desc    Update user profile details and avatar
 * @route   PATCH /api/v1/auth/update-profile
 * @access  Private
 */
export const updateUserProfile = asyncHandler(async (req, res) => {
    const validatedData = updateProfileSchema.parse(req.body);
    const user = await AuthService.updateUserProfile(req.user._id, validatedData, req.file);

    return res.status(200).json(new ApiResponse(200, user, "Profile updated successfully"));
});