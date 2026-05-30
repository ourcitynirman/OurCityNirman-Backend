import { z } from "zod";

const bankDetailsSchema = z.object({
    accountHolderName: z.string().min(3, "Account holder name must be at least 3 characters").optional(),
    accountNumber: z.string().min(9, "Invalid account number").optional(),
    accountType: z.enum(["Savings", "Current"]).optional(),
    ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code").optional(),
    bankName: z.string().min(2, "Bank name is required").optional(),
});

const addressSchema = z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().length(6, "Pincode must be 6 digits").optional(),
    country: z.string().optional(),
});

export const createVendorProfileSchema = z.object({
    fullName: z.string().min(3, "Full name is required"),
    phone: z.string().regex(/^[0-9]{10}$/, "Phone number must be 10 digits"),
    email: z.string().email("Invalid email address"),
    address: addressSchema.optional(),
    aadharNumber: z.string().regex(/^[0-9]{12}$/, "Aadhar number must be 12 digits").optional().or(z.literal("")),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format").optional().or(z.literal("")),
    education: z.string().optional(),
    bankDetails: bankDetailsSchema.optional(),
    gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST number format").optional().or(z.literal("")),
    notes: z.string().optional(),
});

export const updateVendorProfileSchema = createVendorProfileSchema.partial();
