import mongoose from "mongoose";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
            minlength: [3, "Full name must be at least 3 characters"],
            maxlength: [50, "Full name cannot exceed 50 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                "Please provide a valid email",
            ],
            index: true,
        },
        phone: {
            type: String,
            required: [true, "Phone number is required"],
            unique: true,
            trim: true,
            match: [/^[0-9]{10}$/, "Please provide a valid 10-digit phone number"],
            index: true,
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [4, "Password must be at least 4 characters"],
            select: false,
        },
        role: {
            type: String,
            enum: {
                values: ["user", "vendor", "homeowner", "labour", "admin"],
                message: "{VALUE} is not a valid role",
            },
            required: [true, "Role is required"],
            default: "user",
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: false,
        },
        lastLogin: {
            type: Date,
        },
        profileImage: {
            type: String,
            default: null,
        },
        refreshToken: {
            type: String,
            select: false
        },
        tokenVersion: {
            type: Number,
            default: 0
        },
        emailVerifiedAt: {
            type: Date,
            default: null,
        },
        phoneVerifiedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    try {
        this.password = await bcrypt.hash(this.password, 10);
        next();
    } catch (error) {
        next(error);
    }
});


userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};


//  Generate Refresh Token 
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "30d",
        }
    );
};
//  Generate Access Token
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            role: this.role,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d",
        }
    );
};

//  Update last login timestamp
userSchema.methods.updateLastLogin = async function () {
    this.lastLogin = new Date();
    return await this.save({ validateBeforeSave: false });
};

//  Soft delete (deactivate account)
userSchema.methods.deactivate = async function () {
    this.isActive = false;
    return await this.save({ validateBeforeSave: false });
};

//  Reactivate account
userSchema.methods.reactivate = async function () {
    this.isActive = true;
    return await this.save({ validateBeforeSave: false });
};

//  Transform output 
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    delete user.refreshToken;
    delete user.__v;
    return user;
};

userSchema.methods.markEmailVerified = function () {
    this.isVerified = true;
    this.emailVerifiedAt = new Date();
    return this.save();
};



userSchema.methods.updateLastLogin = function () {
    this.lastLogin = new Date();
    return this.save();
};






// Find user by email or phone
userSchema.statics.findByEmailOrPhone = function (email, phone) {
    return this.findOne({
        $or: [{ email }, { phone }],
    });
};


userSchema.statics.findVerifiedUsers = function (filter = {}) {
    return this.find({ ...filter, isVerified: true, isActive: true });
};





userSchema.index({ email: 1, phone: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });




userSchema.virtual("isEmailVerified").get(function () {
    return this.emailVerifiedAt !== null;
});

export const User = mongoose.model("User", userSchema);
