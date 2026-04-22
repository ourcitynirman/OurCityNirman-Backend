import mongoose from 'mongoose';

// OrderItem Collection — separated from Order for scalability
// each document = one line-item in an order

const orderItemSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true,
    },

    // denormalized for vendor-level queries without joining Order
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vendor reference is required'],
      index: true,
    },

    // frozen snapshot at time of order (prices/names can change later)
    productSnapshot: {
      name:     { type: String, required: true },
      image:    { type: String, default: null },
      category: { type: String, default: null },
      brand:    { type: String, default: null },
      sku:      { type: String, default: null },
    },

    quantity:    { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
    price:       { type: Number, required: true, min: [0, 'Price cannot be negative'] },
    totalPrice:  { type: Number, required: true, min: [0, 'Total price cannot be negative'] },

    itemStatus: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
        message: 'Invalid item status: {VALUE}',
      },
      default: 'pending',
      index: true,
    },

    trackingNumber:  { type: String, default: null, trim: true },
    shippingCarrier: { type: String, default: null, trim: true },

    // per-item cancellation reason (vendor can cancel individual items)
    cancelReason: { type: String, default: null, maxlength: 500 },
    cancelledAt:  { type: Date,   default: null },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// vendor dashboard: all items for a vendor sorted by newest
orderItemSchema.index({ vendor: 1, createdAt: -1 });
// vendor + status (e.g. pending items to process)
orderItemSchema.index({ vendor: 1, itemStatus: 1 });
// full order detail fetch
orderItemSchema.index({ order_id: 1 });
// user item-level status tracking
orderItemSchema.index({ user_id: 1, itemStatus: 1 });

// Virtuals
orderItemSchema.virtual('isDelivered').get(function () {
  return this.itemStatus === 'delivered';
});

orderItemSchema.virtual('isCancellable').get(function () {
  return !['delivered', 'cancelled', 'refunded'].includes(this.itemStatus);
});

// Static Methods
// get all items for a given order
orderItemSchema.statics.getByOrder = function (orderId) {
  return this.find({ order_id: orderId })
    .populate('product', 'name images slug')
    .lean();
};

// get all items for a vendor with optional status filter + pagination
orderItemSchema.statics.getVendorItems = function (vendorId, { status, page = 1, limit = 20 } = {}) {
  const filter = { vendor: vendorId };
  if (status) filter.itemStatus = status;

  return this.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('product', 'name images slug')
    .populate('order_id', 'orderNumber totalAmount paymentStatus')
    .lean();
};

// get all items for a user's order history (returns/tracking pages)
orderItemSchema.statics.getUserItems = function (userId, { status } = {}) {
  const filter = { user_id: userId };
  if (status) filter.itemStatus = status;
  return this.find(filter).sort({ createdAt: -1 }).lean();
};

// Instance Methods
// cancel a single line-item with reason
orderItemSchema.methods.cancelItem = function (reason = '', session = null) {
  if (['delivered', 'cancelled', 'refunded'].includes(this.itemStatus)) {
    throw new Error(`Item already in terminal state: ${this.itemStatus}`);
  }
  this.itemStatus   = 'cancelled';
  this.cancelReason = reason;
  this.cancelledAt  = new Date();
  return session ? this.save({ session }) : this.save();
};

// update item shipping info and mark as shipped
orderItemSchema.methods.updateTracking = function (trackingNumber, shippingCarrier) {
  this.trackingNumber  = trackingNumber;
  this.shippingCarrier = shippingCarrier;
  this.itemStatus      = 'shipped';
  return this.save();
};

const OrderItem = mongoose.model('OrderItem', orderItemSchema);

export default OrderItem;
