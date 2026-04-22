
import mongoose from 'mongoose';
import HSN from './HSN.model.js';
const offerSchema = new mongoose.Schema({
  couponCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true
  },
  validTill: {
    type: String,
    trim: true
  }
}, { _id: false });


const productSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vendor ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  brand: {
    type: String,
    required: [true, 'Brand name is required'],
    trim: true,
    index: true
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    index: true,
    enum: {
      values: [
        'Construction Materials',
        'Finishing Materials',
        'Plumbing & Sanitary Ware',
        'Electrical Supplies',
        'Wood & Furniture',
        'Paints & Coatings',
        'Kitchen Appliances',
        'Hardware & Security',
        'Other'
      ],
      message: '{VALUE} is not a valid category'
    }
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    required: [true, 'Original price is required'],
    min: [0, 'Original price cannot be negative']
  },
  basePrice: {
  type: Number,
  default: null,
  min: [0, 'Base price cannot be negative'],
  select: true,
},
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  rating: {
    type: Number,
    default: 0,
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot exceed 5']
  },
  reviews: {
    type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review"
    }],
    default: [],
    set: function(val) {
        if (!Array.isArray(val)) return [];
        return val.filter(id => mongoose.Types.ObjectId.isValid(id));
    }
},

  quantityAvailable: {
    type: Number,
    required: [true, 'Quantity available is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },
  dimensions: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,

  },
  trending: {
    type: Boolean,
    default: false,
    index: true
  },
  images: [
    {
      type: String
    }
  ],
  offer: {
    type: offerSchema,
    default: null
  },
  bestFor: {
    type: String,
    trim: true
  },
  inStock: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false,
    index: true
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  slug: {
    type: String,
    unique: true,
    index: true
  },
  sku: {
    type: String,
    unique: true,
    index: true,
    trim: true,
    uppercase: true
  },
  hsn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HSN',
    default: null,
  },
  igstRate: {
    type: Number,
    default: 18
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});




productSchema.index({ name: 'text', description: 'text', brand: 'text', sku: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ vendorId: 1, isActive: 1 });
productSchema.index({ category: 1, brand: 1 });




productSchema.pre('save', function () {
  if (this.originalPrice && this.price && !this.discount) {
    this.discount = Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }

  if (this.quantityAvailable <= 0) {
    this.inStock = false;
  } else {
    this.inStock = true;
  }


  if (!this.slug) {
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() + '-' + Date.now() + '-' + randomSuffix;
  }

  if (!this.sku) {
    const catPrefix = (this.category || 'GEN').substring(0, 3).toUpperCase();
    const brandPrefix = (this.brand || 'UNK').substring(0, 3).toUpperCase();
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.sku = `${catPrefix}-${brandPrefix}-${randomCode}`;
  }
});


productSchema.virtual('savings').get(function () {
  return this.originalPrice - this.price;
});



productSchema.virtual('isLowStock').get(function () {
  return this.inStock && this.quantityAvailable <= 50;
});



productSchema.statics.getCategories = function () {
  return [
    'Construction Materials',
    'Finishing Materials',
    'Plumbing & Sanitary Ware',
    'Electrical Supplies',
    'Wood & Furniture',
    'Paints & Coatings',
    'Kitchen Appliances',
    'Hardware & Security'
  ];
};



productSchema.statics.getVendorProducts = async function (vendorId, options = {}) {
  const {
    page = 1,
    limit = 50,
    sort = '-createdAt',
    category,
    brand,
    inStock,
    featured,
    search
  } = options;

  const query = { vendorId, isActive: true };

  if (category) query.category = category;
  if (brand) query.brand = brand;
  if (inStock !== undefined) query.inStock = inStock;
  if (featured !== undefined) query.featured = featured;
  if (search) {
    query.$text = { $search: search };
  }

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    this.find(query)
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
  const totalRating  = this.rating * currentCount;
  this.reviewCount   = currentCount + 1;
  this.rating        = Math.round(((totalRating + newRating) / this.reviewCount) * 10) / 10;
  return this.save();
};


const product = mongoose.model("Product", productSchema);

export default product;