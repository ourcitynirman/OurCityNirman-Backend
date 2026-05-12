import { User } from "./user.model.js";
import { OTP } from "./otp.model.js";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import { sendMail } from "../../shared/services/mail.service.js";
import { generateOTP } from "../../shared/utils/generator.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";
import { getOTPEmailTemplate } from "./otp.template.js";
import { getPasswordResetEmailTemplate } from "./reset-password.template.js";
import logger from "../../shared/utils/logger.js";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) throw new ApiError(404, "User not found");

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Token generation failed");
    }
};

class AuthService {
    static async registerUser(userData) {
        const { fullName, email, phone, password, role } = userData;

        const existingUser = await User.findOne({
            $or: [{ email }, { phone }],
        });

        if (existingUser) {
            if (existingUser.email === email) throw new ApiError(409, "User with this email already exists");
            if (existingUser.phone === phone) throw new ApiError(409, "User with this phone already exists");
        }

        const otp = generateOTP();
        const hashedOtp = await bcrypt.hash(otp.toString(), 12);
        const hashedPasswordForMetadata = await bcrypt.hash(password, 12);

        await OTP.deleteMany({ email, type: "registration" });

        await OTP.create({
            email,
            otp: hashedOtp,
            type: "registration",
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            metadata: {
                fullName,
                phone,
                password: hashedPasswordForMetadata,
                role,
            },
        });

        await sendMail({
            to: email,
            subject: "Complete Your Registration - OTP Verification",
            html: getOTPEmailTemplate(otp, fullName),
        });

        return { email };
    }

    static async verifyRegistrationOTP(email, otpStr) {
        const otpRecord = await OTP.findOne({
            email,
            type: "registration",
            isUsed: false,
        }).sort({ createdAt: -1 });

        if (!otpRecord) throw new ApiError(400, "OTP not found or already used. Please request a new OTP.");
        if (otpRecord.expiresAt < Date.now()) throw new ApiError(400, "OTP expired. Please request a new one.");
        if (otpRecord.attempts >= 5) throw new ApiError(429, "Too many incorrect attempts. Please request a new OTP.");

        const isValid = await bcrypt.compare(otpStr, otpRecord.otp);

        if (!isValid) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            throw new ApiError(400, `Invalid OTP. ${5 - otpRecord.attempts} attempts remaining.`);
        }

        const { fullName, phone, password, role } = otpRecord.metadata;

        const existingUser = await User.findOne({
            $or: [{ email }, { phone }],
        });

        if (existingUser) throw new ApiError(409, "User already exists with this email or phone");

        const user = await User.create({
            fullName,
            email,
            phone,
            password,
            role,
            isActive: true,
            isVerified: true,
        });

        otpRecord.isUsed = true;
        await otpRecord.save();

        const createdUser = await User.findById(user._id).select("-password -refreshToken");
        if (!createdUser) throw new ApiError(500, "User registration failed");

        // Generate tokens for auto-login
        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(createdUser._id);

        return { user: createdUser, accessToken, refreshToken };
    }

    static async resendRegistrationOTP(email) {
        const normalizedEmail = email.toLowerCase();
        const lastOtp = await OTP.findOne({
            email: normalizedEmail,
            type: "registration",
            isUsed: false,
        }).sort({ createdAt: -1 });

        if (!lastOtp) {
            throw new ApiError(400, "No pending registration found. Please start registration again.");
        }

        const timeSinceLastOtp = Date.now() - lastOtp.createdAt.getTime();
        if (timeSinceLastOtp < 30 * 1000) {
            const waitTime = Math.ceil((30 * 1000 - timeSinceLastOtp) / 1000);
            throw new ApiError(429, `Please wait ${waitTime} seconds before requesting a new OTP`);
        }

        const otp = generateOTP();
        const hashedOtp = await bcrypt.hash(otp.toString(), 12);

        await OTP.deleteMany({ email, type: "registration" });

        await OTP.create({
            email,
            otp: hashedOtp,
            type: "registration",
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            metadata: lastOtp.metadata,
        });

        await sendMail({
            to: email,
            subject: "Complete Your Registration - OTP Verification",
            html: getOTPEmailTemplate(otp, lastOtp.metadata.fullName),
        });

        return { email };
    }

    static async loginUser({ email, phone, password }) {
        const query = {};
        if (email) query.email = email.toLowerCase();
        else if (phone) query.phone = phone;

        const user = await User.findOne(query).select("+password");

        if (!user) throw new ApiError(401, "Invalid credentials");
        if (!user.isVerified) throw new ApiError(403, "Please verify your email before logging in");
        if (!user.isActive) throw new ApiError(403, "Your account has been deactivated. Please contact support.");

        const isPasswordValid = await user.isPasswordCorrect(password);
        if (!isPasswordValid) throw new ApiError(401, "Invalid credentials");

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

        user.lastLogin = new Date();
        user.save({ validateBeforeSave: false }).catch((err) =>
            logger.error("Failed to update last login:", { error: err.message })
        );

        const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
        if (!loggedInUser) throw new ApiError(500, "Login failed. Please try again.");

        return { user: loggedInUser, accessToken, refreshToken };
    }

    static async logoutUser(userId) {
        await User.findByIdAndUpdate(
            userId,
            { $unset: { refreshToken: 1 } },
            { returnDocument: 'after' }
        );
    }

    static async logoutAllDevices(userId) {
        await User.findByIdAndUpdate(userId, {
            $unset: { refreshToken: 1 },
            $inc: { tokenVersion: 1 }
        });
    }

    static async refreshAccessToken(incomingRefreshToken) {
        if (!incomingRefreshToken) throw new ApiError(401, "Refresh token is required");

        try {
            const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
            const user = await User.findById(decoded._id).select("+refreshToken");

            if (!user) throw new ApiError(401, "Invalid refresh token");
            if (incomingRefreshToken !== user.refreshToken) throw new ApiError(401, "Refresh token is expired or used");

            const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

            return { accessToken, refreshToken: newRefreshToken };
        } catch (error) {
            throw new ApiError(401, error?.message || "Invalid refresh token");
        }
    }

    static async changePassword(userId, oldPassword, newPassword) {
        const user = await User.findById(userId).select("+password");
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

        if (!isPasswordCorrect) throw new ApiError(400, "Invalid old password");

        user.password = newPassword;
        await user.save({ validateBeforeSave: false });
    }

    static async forgotPassword(email) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) throw new ApiError(404, "User not found with this email");

        const resetToken = jwt.sign(
            { _id: user._id },
            process.env.RESET_PASSWORD_SECRET,
            { expiresIn: "15m" }
        );

        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        await sendMail({
            to: user.email,
            subject: "Reset Your Password – Our City Nirman",
            html: getPasswordResetEmailTemplate(resetLink, user.fullName),
        });
    }
 
    static async resetPassword(token, newPassword) {
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.RESET_PASSWORD_SECRET);
        } catch (e) {
            throw new ApiError(400, "Invalid or expired token");
        }

        const user = await User.findById(decoded._id).select("+password");
        if (!user) throw new ApiError(400, "Invalid or expired token");

        user.password = newPassword;
        await user.save({ validateBeforeSave: false });
    }

    static async updateUserProfile(userId, bodyUpdates, file) {
        const updates = { ...bodyUpdates };

        if (updates.phone) {
            const existing = await User.findOne({ phone: updates.phone, _id: { $ne: userId } });
            if (existing) throw new ApiError(409, "Phone number already in use by another account");
        }

        const user = await User.findById(userId);
        if (!user) throw new ApiError(404, "User not found");

        if (file) {
            const uploadResult = await uploadOnCloudinary(file.path, true);
            if (!uploadResult || !uploadResult.success) {
                throw new ApiError(500, uploadResult?.error || "Failed to upload image. Try again.");
            }
            updates.profileImage = uploadResult.url;

            if (user.profileImage && user.profileImage.includes("cloudinary.com")) {
                try {
                    const urlParts = user.profileImage.split("/");
                    const filename = urlParts[urlParts.length - 1];
                    const publicId = filename.split(".")[0];
                    await deleteFromCloudinary(publicId, true);
                } catch (err) {
                    logger.warn("Could not delete old profile image:", err.message);
                }
            }
        } else if (updates.removeProfileImage) {
            // Delete existing image if any
            if (user.profileImage && user.profileImage.includes("cloudinary.com")) {
                try {
                    const urlParts = user.profileImage.split("/");
                    const filename = urlParts[urlParts.length - 1];
                    const publicId = filename.split(".")[0];
                    await deleteFromCloudinary(publicId, true);
                } catch (err) {
                    logger.warn("Could not delete profile image:", err.message);
                }
            }
            updates.profileImage = null;
        }

        // Clean up internal flag before saving to DB
        delete updates.removeProfileImage;


        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { returnDocument: 'after', runValidators: true }
        ).select("-password -refreshToken");

        if (!updatedUser) throw new ApiError(404, "User not found");

        return updatedUser;
    }
}

export default AuthService;
