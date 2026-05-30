import mongoose from "mongoose";

const vendorProfileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
        },
        phone: {
            type: String,
            required: [true, "Phone number is required"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            trim: true,
            lowercase: true,
        },
        address: {
            street: String,
            city: String,
            state: String,
            pincode: String,
            country: { type: String, default: "India" },
        },
        aadharNumber: {
            type: String,
            sparse: true,
            unique: true,
            trim: true,
        },
        panNumber: {
            type: String,
            sparse: true,
            unique: true,
            trim: true,
            uppercase: true,
        },
        education: {
            type: String,
            trim: true,
        },
        bankDetails: {
            accountHolderName: { type: String, trim: true },
            accountNumber: { type: String, trim: true },
            accountType: { 
                type: String, 
                enum: ["Savings", "Current"],
                default: "Savings"
            },
            ifscCode: { type: String, trim: true, uppercase: true },
            bankName: { type: String, trim: true },
        },
        gstNumber: {
            type: String,
            trim: true,
            uppercase: true,
        },
        notes: {
            type: String,
            trim: true,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        }
    },
    {
        timestamps: true,
    }
);

const VendorProfile = mongoose.model("VendorProfile", vendorProfileSchema);

export default VendorProfile;
