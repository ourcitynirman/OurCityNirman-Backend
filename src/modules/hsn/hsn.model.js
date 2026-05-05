import mongoose from 'mongoose';

const hsnSchema = new mongoose.Schema(
  {
    hsn_code: {
      type: String,
      required: [true, 'HSN code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    gst_rate: {
      type: Number,
      required: [true, 'GST rate is required'],
      enum: {
        values: [0, 5, 12, 18, 28],
        message: '{VALUE} is not a valid GST rate',
      },
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      enum: {
        values: ['pcs', 'kg', 'litre', 'meter'],
        message: '{VALUE} is not a valid unit',
      },
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
hsnSchema.index({ hsn_code: 'text', description: 'text' });

const HSN = mongoose.model('HSN', hsnSchema);

export default HSN;
