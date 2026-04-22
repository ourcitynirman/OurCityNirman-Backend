
import mongoose from "mongoose";

const vendorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  vendorUniqueId: {
    type: String,
    unique: true,
    index: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true,
  },

  businessType: {
    type: String,
    required: true,
    enum: ['retail', 'wholesale', 'manufacturer', 'distributor', 'other']
  },

  description: {
    type: String,
    maxlength: 2000,
    trim: true
  },

  avatar: { type: String },
  coverImage: { type: String },
  website: {
    type: String,
    trim: true,
    lowercase: true,
    index: true,
    validate: {
      validator: function (value) {
        if (!value) return true; 
        return /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/.test(value);
      },
      message: 'Invalid website URL'
    }
  },

  gstNumber: {
    type: String,
    sparse: true,
    index: true
  },

  panNumber: {
    type: String,
    sparse: true
  },

  businessAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'India' }
  },

  contactInfo: {
    phone: String,
    alternatePhone: String,
    whatsapp: String,
    email: String
  },

  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },

  verificationDocuments: [{
    type: { type: String },
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },


  totalProducts: {
    type: Number,
    default: 0,
    index: true
  },


  totalOrders: {
    type: Number,
    default: 0
  },

  totalRevenue: {
    type: Number,
    default: 0
  },

  bankDetails: {
    accountNumber: { type: String, select: false },
    ifscCode: { type: String, select: false },
    accountHolderName: { type: String, select: false },
    bankName: String
  },

  operatingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  }

}, {
  timestamps: true
});

//  Compound index
vendorProfileSchema.index({ isVerified: 1, isActive: 1, 'rating.average': -1 });

//  Text search index
vendorProfileSchema.index({
  businessName: 'text',
  description: 'text'
});

const VendorProfile = mongoose.model("VendorProfile", vendorProfileSchema);

export default VendorProfile;