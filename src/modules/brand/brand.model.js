import mongoose from "mongoose";

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Brand name is required'],
    unique: true,
    trim: true,
    index: true
  },
  slug: {
    type: String,
    unique: true,
    index: true
  },
  logo: {
    type: String,
    default: null
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  // Category Mapping: Which categories does this brand operate in?
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    index: true
  }],

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  popularityScore: {
    type: Number,
    default: 0,
    index: true
  }

}, { timestamps: true });

// Text index for search functionality
brandSchema.index({ name: "text", description: "text" });

// Auto-generate slug before saving
brandSchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
  next();
});

const Brand = mongoose.models.Brand || mongoose.model("Brand", brandSchema);
export default Brand;
