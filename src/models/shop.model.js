import mongoose from "mongoose";

const verificationHistorySchema = new mongoose.Schema(
    {
        action: {
            type: String,
            enum: ["requested", "approved", "rejected", "re_requested"],
            required: true
        },

        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        performedByRole: {
            type: String,
            enum: ["vendor", "admin", "system"],
            default: "system"
        },
        note: { 
            type: String, 
            trim: true, 
            maxlength: 500,
             default: null
             },
        at: { 
            type: Date, 
            default: Date.now 
        },
    },
    { _id: false }
);

const shopSchema = new mongoose.Schema(
    {
        vendor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Vendor is required"],
            unique: true,
            index: true,
        },
        shopCode: { type: String, unique: true, index: true },

        shopname: {
            type: String,
            required: [true, "Shop name is required"],
            trim: true,
            minlength: [2, "Shop name must be at least 2 characters"],
            maxlength: [100, "Shop name cannot exceed 100 characters"],
        },

        slug: {
             type: String, 
             unique: true, 
             lowercase: true, 
             trim: true,
              index: true 
            },

        storeType: {
            type: String,
            enum: { 
                values: ["Retail", "Wholesale", "Manufacturer", "Distributor", "Service Provider"], 
                message: "Invalid store type: {VALUE}" },

            default: null,
        },
        category: {
            type: String,
            required: [true, "Shop category is required"],
            enum: {
                values: ["Construction Materials", "Finishing Materials", "Plumbing & Sanitary Ware",
                    "Electrical Supplies", "Wood & Furniture", "Paints & Coatings",
                    "Kitchen Appliances", "Hardware & Security"],
                message: "Invalid shop category: {VALUE}",
            },
        },
        description: { type: String, trim: true, maxlength: [1000, "Description cannot exceed 1000 characters"], default: null },
        tagline: { type: String, trim: true, maxlength: [150, "Tagline cannot exceed 150 characters"], default: null },

        logo: { type: String, default: null },
        banner: { type: String, default: null },

        phone: { type: String, trim: true, default: null, validate: { validator: (v) => !v || /^\+?[\d\s\-()\[\]]{7,20}$/.test(v), message: "Please provide a valid phone number" } },
        alternativephone: { type: String, trim: true, default: null, validate: { validator: (v) => !v || /^\+?[\d\s\-()\[\]]{7,20}$/.test(v), message: "Please provide a valid alternative phone number" } },
        email: { type: String, trim: true, lowercase: true, default: null, validate: { validator: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: "Please provide a valid email" } },
        website: {
            type: String, trim: true, default: null, maxlength: [200, "Website URL cannot exceed 200 characters"],
            validate: { validator: (v) => !v || /^(https?:\/\/)(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/\S*)?$/.test(v), message: "Please provide a valid website URL" },
        },

        //  Address
        address: {
            village: { type: String, trim: true, default: null },
            post: { type: String, trim: true, default: null },
            policeStation: { type: String, trim: true, default: null },
            block: { type: String, trim: true, default: null },
            district: { type: String, trim: true, default: null },
            landmark: { type: String, trim: true, default: null },
            city: { type: String, trim: true, default: null },
            pincode: { type: String, trim: true, default: null },
            state: { type: String, trim: true, default: null },
            notes: { type: String, trim: true, default: null },
            country: { type: String, trim: true, default: "India" },
        },

        gstNumber: {
            type: String, trim: true, uppercase: true, default: null,
            validate: { validator: (v) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v), message: "Please provide a valid GST number" },
        },
        financeOptions: {
            type: [String],
            enum: { values: ["Cash", "UPI", "Net Banking", "Credit Card", "Debit Card", "EMI", "Cheque", "Bank Transfer"], message: "Invalid finance option: {VALUE}" },
            default: [],
        },

        availability: {
            openTime: { type: String, default: null },
            closeTime: { type: String, default: null },
            daysOpen: {
                type: [String],
                enum: { values: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], message: "Invalid day: {VALUE}" },
                default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            },
        },

        deliveryAreas: { type: [String], default: [] },

        isActive: { type: Boolean, default: true },
        isVerified: { type: Boolean, default: false },

        verificationStatus: {
            type: String,
            enum: { values: ["not_requested", "pending", "approved", "rejected"], message: "Invalid verification status" },
            default: "not_requested",
            index: true,
        },

        verificationDocs: {
            gstDocument: { type: String, default: null },
            panDocument: { type: String, default: null },
            otherDocument: { type: String, default: null },
            submittedAt: { type: Date, default: null },
        },

        rejectionReason: {
            type: String, trim: true,
            maxlength: [500, "Rejection reason cannot exceed 500 characters"],
            default: null,
        },

        verificationResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

        verificationRequestedAt: { type: Date, default: null },
        verificationResolvedAt: { type: Date, default: null },

        verificationHistory: { type: [verificationHistorySchema], default: [] },

        verificationAttempts: { type: Number, default: 0, min: 0 },

        totalProducts: { type: Number, default: 0, min: 0 },
        totalOrders: { type: Number, default: 0, min: 0 },
        rating: {
            average: { type: Number, default: 0, min: 0, max: 5 },
            count: { type: Number, default: 0, min: 0 },
        },
    },
    { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

shopSchema.index({ category: 1, isActive: 1 });
shopSchema.index({ isActive: 1, isVerified: 1 });
shopSchema.index({ verificationStatus: 1, createdAt: -1 }); // admin pending queue

shopSchema.virtual("fullAddress").get(function () {
    const a = this.address;
    return [a.village, a.post, a.policeStation, a.block, a.district, a.landmark, a.city, a.pincode, a.state, a.country]
        .filter(Boolean).join(", ");
});

shopSchema.virtual("canRequestVerification").get(function () {
    return ["not_requested", "rejected"].includes(this.verificationStatus);
});

shopSchema.pre("save", function (next) {
    if (this.isModified("shopname")) {
        this.slug =
            this.shopname.toLowerCase().trim()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-") +
            "-" + this._id.toString().slice(-5);
    }
    next();
});

shopSchema.statics.findByVendor = function (vendorId) { return this.findOne({ vendor: vendorId }); };
shopSchema.statics.existsForVendor = async function (vendorId) { return (await this.countDocuments({ vendor: vendorId })) > 0; };

shopSchema.statics.getPendingVerifications = function (limit = 20, skip = 0) {
    return this.find({ verificationStatus: "pending" })
        .populate("vendor", "fullName email phone createdAt")
        .sort({ verificationRequestedAt: 1 }) 
        .skip(skip).limit(limit).lean();
};

const Shop = mongoose.model("Shop", shopSchema);
export default Shop;