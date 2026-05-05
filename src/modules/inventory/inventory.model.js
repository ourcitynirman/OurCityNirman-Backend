import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductListing',
    required: true,
    unique: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  availableQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  warehouseLocation: {
    type: String,
    trim: true
  },
  lastStockUpdate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Atomic stock update method
inventorySchema.statics.adjustStock = async function(listingId, adjustment) {
  const inventory = await this.findOneAndUpdate(
    { listingId, availableQuantity: { $gte: adjustment < 0 ? Math.abs(adjustment) : 0 } },
    { 
      $inc: { availableQuantity: adjustment },
      $set: { lastStockUpdate: new Date() }
    },
    { new: true }
  );
  
  if (!inventory) {
    throw new Error('Insufficient stock or listing not found');
  }
  
  return inventory;
};

const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
export default Inventory;
