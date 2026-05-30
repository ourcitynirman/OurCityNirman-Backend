import mongoose from 'mongoose';
import HSN from '../hsn/hsn.model.js';
import Category from '../category/category.model.js';

const offerSchema = new mongoose.Schema({
  couponCode: { type: String, trim: true, uppercase: true },
  description: { type: String, trim: true },
  validTill: { type: String, trim: true }
}, { _id: false });

const productSchema = new mongoose.Schema({
  // GLOBAL IDENTITY
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters'],
    index: true
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: [true, 'Brand is required'],
    index: true
  },
  /**
   * @property {ObjectId} category - Primary leaf category of the product
   */
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
    index: true
  },

  /**
   * @property {ObjectId[]} categoryAncestors - Flattened array of category and its parents (root to leaf).
   * Used for high-performance hierarchical filtering (e.g., searching for "Construction Materials" returns all sub-categories).
   */
  categoryAncestors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  slug: {
    type: String,
    unique: true,
    index: true
  },
  modelNumber: {
    type: String,
    trim: true,
    index: true
  },

  // CATALOG METADATA (Shared across all vendors)
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Product description is too long'],
  },
  keyFeatures: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true,
    index: true
  }],

  images: [{
    url: { type: String, required: true },
    alt: { type: String, default: '' },
    isPrimary: { type: Boolean, default: false }
  }],

  // SPECIFICATIONS & ATTRIBUTES
  dimensions: { type: String, trim: true },
  weight: { type: Number, default: 0 }, // in kg
  material: { type: String, trim: true },
  warranty: { type: String, trim: true },
  origin: { type: String, trim: true },
  bestFor: { type: String, trim: true },
  company: { type: String, trim: true }, // Manufacturer
  unit: { type: String, trim: true, default: 'Piece' }, // Bag, kg, etc.

  specifications: {
    type: Map,
    of: String,
    default: {}
  },
  attributes: [{
    name: { type: String, required: true },
    value: { type: String, required: true }
  }],

  // GLOBAL AGGREGATES (Updated by background hooks)
  rating: {
    type: Number,
    default: 0,
    index: true
  },
  reviewCount: {
    type: Number,
    default: 0
  },

  // TAX & LEGAL
  hsn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HSN',
    default: null,
  },

  // ADMIN FLAGS
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  trending: {
    type: Boolean,
    default: false,
    index: true
  },
  isApproved: {
    type: Boolean,
    default: false,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  isPopular: {
    type: Boolean,
    default: false,
    index: true
  },

  // PRICING & INVENTORY
  price: { type: Number, required: true, index: true },
  originalPrice: { type: Number },
  basePrice: { type: Number }, // Vendor's cost price
  discount: { type: Number, default: 0 },
  quantityAvailable: { type: Number, default: 0, index: true },
  minOrder: { type: Number, default: 1 },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sku: { type: String, unique: true, index: true },
  inStock: { type: Boolean, default: true, index: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Wildcard index for dynamic specifications filtering
productSchema.index({ "specifications.$**": 1 });

// OPTIMIZE COMPOUND INDEXES (These are not duplicates of inline single-field indexes)
productSchema.index({ vendorId: 1, isActive: 1 });
productSchema.index({ category: 1, brand: 1, isActive: 1 }); // Optimized for Amazon-style filtering
productSchema.index({ isActive: 1, featured: 1 });
productSchema.index({ isActive: 1, trending: 1 });
productSchema.index({ categoryAncestors: 1, isActive: 1 });
productSchema.index({ name: 'text', description: 'text', brand: 'text', sku: 'text' });
productSchema.index({ categoryAncestors: 1, isActive: 1, price: 1 }); // High-performance search index
productSchema.index({ createdAt: -1 });

// PRE-SAVE HOOK improvements
productSchema.pre('save', async function () {
  try {
    if (this.originalPrice && this.price && !this.discount) {
      this.discount = Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
    }

    if (this.quantityAvailable <= 0) {
      this.inStock = false;
    } else {
      this.inStock = true;
    }

    if (!this.slug) {
      const baseSlug = this.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
      let newSlug = baseSlug;
      let counter = 1;
      while (await mongoose.models.Product.exists({ slug: newSlug })) {
        newSlug = `${baseSlug}-${counter}`;
        counter++;
      }
      this.slug = newSlug;
    }

    if (!this.sku) {
      const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      this.sku = `PROD-${Date.now().toString().slice(-4)}-${randomCode}`;
    }

    if (this.isModified('category')) {
      const CategoryModel = mongoose.models.Category || mongoose.model('Category');
      const category = await CategoryModel.findById(this.category).select('ancestors').lean();
      if (category) {
        this.categoryAncestors = category.ancestors ? category.ancestors.map(a => a._id) : [];
        this.categoryAncestors.push(this.category);
      } else {
        this.categoryAncestors = [];
      }

      // Automatically fetch and assign the HSN code based on category hierarchy
      const HSNModel = mongoose.models.HSN || mongoose.model('HSN');
      let hsnRecord = await HSNModel.findOne({ category: this.category, is_active: true });
      
      // If no direct HSN, check parent categories from bottom-up
      if (!hsnRecord && category && category.ancestors && category.ancestors.length > 0) {
        for (let i = category.ancestors.length - 1; i >= 0; i--) {
          hsnRecord = await HSNModel.findOne({ category: category.ancestors[i]._id, is_active: true });
          if (hsnRecord) break;
        }
      }
      
      if (hsnRecord) {
        this.hsn = hsnRecord._id;
      } else {
        this.hsn = null;
      }
    }

  } catch (error) {
    throw error;
  }
});

// AUTO BRAND-CATEGORY SYNC (Amazon Style)
// Automatically link the brand to the category when a product is saved
productSchema.post('save', async function () {
  try {
    const Brand = mongoose.models.Brand || mongoose.model('Brand');
    if (this.brand && this.category) {
      await Brand.updateOne(
        { _id: this.brand },
        { $addToSet: { categories: this.category } }
      );
    }
  } catch (error) {
    console.error("Brand-Category Sync Error:", error);
  }
});

// VIRTUALS
productSchema.virtual('savings').get(function () {
  return this.originalPrice - this.price;
});

productSchema.virtual('isLowStock').get(function () {
  return this.inStock && this.quantityAvailable <= 50;
});

productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'productId'
});

// STATICS
productSchema.statics.getVendorProducts = async function (vendorId, options = {}) {
  const { page = 1, limit = 50, sort = '-createdAt', category, brand, inStock, featured, trending, search, sku } = options;

  const query = { vendorId, isActive: true };

  if (category) query.category = category;
  if (brand) query.brand = brand;
  if (sku) query.sku = sku;
  if (inStock !== undefined) query.inStock = inStock;
  if (featured !== undefined) query.featured = featured;
  if (trending !== undefined) query.trending = trending;
  if (search) query.$text = { $search: search };

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    this.find(query)
      .populate({ path: 'category', select: 'name slug' })
      .populate({ path: 'brand', select: 'name slug logo' }) // Populate brand
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    products,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    }
  };
};

// METHODS
productSchema.methods.updateStock = async function (quantity) {
  this.quantityAvailable += quantity;
  if (this.quantityAvailable <= 0) {
    this.quantityAvailable = 0;
    this.inStock = false;
  } else {
    this.inStock = true;
  }
  return this.save();
};

productSchema.methods.updateRating = async function (newRating) {
  const currentCount = this.reviewCount || 0;
  const totalRating = this.rating * currentCount;
  this.reviewCount = currentCount + 1;
  this.rating = Math.round(((totalRating + newRating) / this.reviewCount) * 10) / 10;
  return this.save();
};

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;