import mongoose from 'mongoose';

const productListingSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  inStock: {
    type: Boolean,
    default: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isFlashSale: {
    type: Boolean,
    default: false
  },
  flashSalePrice: {
    type: Number,
    default: null
  },
  shippingCharge: {
    type: Number,
    default: 0
  },
  returnPolicy: {
    type: String,
    default: '7 Days Return'
  },
  warranty: {
    type: String,
    default: 'No Warranty'
  },
  // Multi-variant support: This listing applies to specific variant options
  variantCombination: {
    type: Map,
    of: String // e.g., { color: "Red", size: "XL" }
  }
}, {
  timestamps: true
});

// Index for finding the best price for a product
productListingSchema.index({ productId: 1, price: 1, isActive: 1 });

// Ensure a vendor can't list the same product variant twice
productListingSchema.index({ productId: 1, vendorId: 1, variantCombination: 1 }, { unique: true });

const ProductListing = mongoose.models.ProductListing || mongoose.model('ProductListing', productListingSchema);
export default ProductListing;
