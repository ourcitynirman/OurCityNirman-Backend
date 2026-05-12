import { z } from "zod";
import { ALL_ROLES, ROLES } from "../../shared/constants/roles.js";

const allowedRoles = ALL_ROLES.filter(r => r !== ROLES.ADMIN);

export const registerSchema = z.object({
    fullName: z.string().trim().min(3, "Full name must be at least 3 characters").max(50, "Full name cannot exceed 50 characters"),
    email: z.string().trim().toLowerCase().email("Invalid email format"),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Invalid mobile number"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(allowedRoles, {
        errorMap: () => ({ message: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` })
    })
});

export const verifyOTPSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email format"),
    otp: z.string().min(1, "OTP is required"),
});

export const resendOTPSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email format"),
});

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email format").optional(),
    phone: z.string().trim().regex(/^[0-9]{10}$/, "Invalid mobile number").optional(),
    password: z.string().min(1, "Password is required"),
}).refine(data => data.email || data.phone, {
    message: "Email or phone number is required",
    path: ["email"],
});

export const changePasswordSchema = z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z.string().min(4, "New password must be at least 4 characters"),
});

export const forgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email format"),
});

export const resetPasswordSchema = z.object({
    newPassword: z.string().min(4, "New password must be at least 4 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export const updateProfileSchema = z.object({
    fullName: z.string().trim().min(3).max(50).optional(),
    phone: z.string().trim().regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits").optional(),
    removeProfileImage: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
});

