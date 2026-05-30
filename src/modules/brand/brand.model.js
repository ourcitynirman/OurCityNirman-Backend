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
    trim: true
  },
  image: {
    type: String
  },
  banner: {
    type: String
  },
  icon: {
    type: String
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
  },

  seoTitle: {
    type: String,
    trim: true,
    maxlength: [100, 'SEO Title cannot exceed 100 characters']
  },
  seoDescription: {
    type: String,
    trim: true,
    maxlength: [300, 'SEO Description cannot exceed 300 characters']
  },

  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isVerified: {
    type: Boolean,
    default: true,
    index: true
  },

  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active',
    index: true
  }

}, { timestamps: true });

// Text index for search functionality
brandSchema.index({ name: "text", description: "text" });

// Auto-generate slug before saving
brandSchema.pre("save", async function () {
  if (this.isModified("name") || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
});

const Brand = mongoose.models.Brand || mongoose.model("Brand", brandSchema);
export default Brand;
