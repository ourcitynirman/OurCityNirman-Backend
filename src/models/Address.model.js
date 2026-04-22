import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
    {

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
        },



        addressType: {
            type: String,
            enum: {
                values: ['home', 'office', 'other'],
                message: 'Address type must be home, work, or other',
            },
            default: 'home',
        },

        // Recipient 
        fullName: {
            type: String,

            trim: true,
            minlength: [2, 'Full name must be at least 2 characters'],
            maxlength: [100, 'Full name cannot exceed 100 characters'],
        },
        phone: {
            type: String,
            required: [true, "Phone number is required"],

            trim: true,
            match: [/^[0-9]{10}$/, "Please provide a valid 10-digit phone number"],

        },
        alternatePhone: {
            type: String,
            trim: true,

        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            validate: {
                validator: (v) => /^\S+@\S+\.\S+$/.test(v),
                message: 'Please provide a valid email address',
            },
        },
        //  Address Lines 
        line1: {
            type: String,

            trim: true,
            maxlength: [200, 'Address line 1 cannot exceed 200 characters'],
        },
        line2: {
            type: String,
            trim: true,
            maxlength: [200, 'Address line 2 cannot exceed 200 characters'],
            default: null,
        },
        landmark: {
            type: String,
            trim: true,
            maxlength: [200, 'Landmark cannot exceed 200 characters'],
            default: null,
        },
        village: {
            type: String,
            trim: true,
            maxlength: [100, 'Village cannot exceed 100 characters'],
            default: null,
        },

        // Location 
        city: {
            type: String,

            trim: true,
            maxlength: [100, 'City name cannot exceed 100 characters'],
        },
        state: {
            type: String,

            trim: true,
            maxlength: [100, 'State name cannot exceed 100 characters'],
        },
        pincode: {
            type: String,

            trim: true,
            validate: {
                validator: (v) => /^[A-Z0-9\s\-]{3,10}$/i.test(v),
                message: 'Please provide a valid pincode',
            },
        },
        country: {
            type: String,

            trim: true,
            maxlength: [100, 'Country name cannot exceed 100 characters'],
            default: 'India',
        },


        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Indexes 
addressSchema.index({ user: 1 });                  
addressSchema.index({ user: 1, isDefault: 1 });     
addressSchema.index({ user: 1, createdAt: -1 });    


addressSchema.virtual('fullAddress').get(function () {
    return [
        this.line1,
        this.line2,
        this.village,
        this.landmark,
        this.city,
        this.state,
        this.pincode,
        this.country,
    ]
        .filter(Boolean)
        .join(', ');
});



addressSchema.pre('save', async function () {
    if (this.isDefault && this.isModified('isDefault')) {
        await this.constructor.updateMany(
            { user: this.user, _id: { $ne: this._id } },
            { $set: { isDefault: false } }
        );
    }
});


addressSchema.statics.getDefaultAddress = function (userId) {
    return this.findOne({ user: userId, isDefault: true });
};

addressSchema.statics.getUserAddresses = function (userId, { limit = 10, skip = 0, sort = { isDefault: -1, createdAt: -1 } } = {}) {
    return this.find({ user: userId })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
};

addressSchema.statics.countUserAddresses = function (userId) {
    return this.countDocuments({ user: userId });
};



addressSchema.methods.setAsDefault = function () {
    this.isDefault = true;
    return this.save();
};

const Address = mongoose.model('Address', addressSchema);

export default Address;