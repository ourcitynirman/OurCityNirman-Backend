import mongoose from 'mongoose';

const hsnSchema = new mongoose.Schema(
  {
   /* hsn_id: {
      type: String,
      required: [true, 'HSN ID is required'],
      unique: true,
      trim: true,
    },*/

    hsn_code: {
      type: String,
      required: [true, 'HSN code is required'],
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    category: {
      type: String,
      //add category from categories tables which manage all categories by admin
      // ref: 'Category',
      
      required: [true, 'Category is required'],
    },

    gst_rate: {
      type: Number,
      required: [true, 'GST rate is required'],
      min: [0, 'GST rate cannot be negative'],
      max: [100, 'GST rate cannot exceed 100'],
    },

    unit: {
      type: String,
      trim: true,
      
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
hsnSchema.index({ hsn_code: 1 });
hsnSchema.index({ category: 1 });

// Static Methods
hsnSchema.statics.getActiveHSN = function () {
  return this.find({ is_active: true });
};

hsnSchema.statics.findByCode = function (code) {
  return this.findOne({ hsn_code: code });
};

// Instance Method
hsnSchema.methods.deactivate = function () {
  this.is_active = false;
  return this.save();
};

const HSN = mongoose.model('HSN', hsnSchema);

export default HSN;
