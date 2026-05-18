import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

// category to estimated delivery days mapping
export const CATEGORY_DELIVERY_DAYS = {
  'Construction Materials':  10,
  'Finishing Materials':      7,
  'Plumbing & Sanitary Ware': 6,
  'Electrical Supplies':      5,
  'Wood & Furniture':         8,
  'Paints & Coatings':        5,
  'Kitchen Appliances':       6,
  'Hardware & Security':      5,
  'Other':                    7,
  'default':                  7,
};

// compute estimated delivery date based on slowest product category, skips weekends
export function calcEstimatedDelivery(categories = []) {
  let maxDays = CATEGORY_DELIVERY_DAYS['default'];

  for (const cat of categories) {
    const days = CATEGORY_DELIVERY_DAYS[cat] ?? CATEGORY_DELIVERY_DAYS['default'];
    if (days > maxDays) maxDays = days;
  }

  const date = new Date();
  date.setDate(date.getDate() + maxDays);

  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

// frozen delivery address snapshot — small, immutable, always read with Order
const addressSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, 'Full name is required'] },
    phone:    { type: String, required: [true, 'Phone is required'] },
    line1:    { type: String, required: [true, 'Address line 1 is required'] },
    line2:    { type: String, default: null },
    village:  { type: String, default: null },
    landmark: { type: String, default: null },
    city:     { type: String, required: [true, 'City is required'] },
    state:    { type: String, required: [true, 'State is required'] },
    pincode:  { type: String, required: [true, 'Pincode is required'] },
    country:  { type: String, default: 'India' },
  },
  { _id: false }
);

// status history entries — bounded array, always read with Order
const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
    },
    changedAt: { type: Date,   default: Date.now },
    note:      { type: String, default: null, maxlength: 300 },
    changedBy: {
      type:    String,
      enum:    ['user', 'vendor', 'admin', 'system'],
      default: 'system',
    },
  },
  { _id: false }
);

// NOTE: items array removed — stored in OrderItem collection (ref: order_id)
// fetch items via OrderItem.getByOrder(orderId)
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type:   String,
      unique: true,
      index:  true,
    },

    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'User is required'],
      index:    true,
    },

    // immutable address snapshot
    deliveryAddress: {
      type:     addressSnapshotSchema,
      required: [true, 'Delivery address is required'],
    },

    // Financials
    subtotal:       { type: Number, required: [true, 'Subtotal is required'],     min: [0, 'Cannot be negative'] },
    deliveryCharge: { type: Number, default: 0,                                   min: [0, 'Cannot be negative'] },
    discount:       { type: Number, default: 0,                                   min: [0, 'Cannot be negative'] },
    totalAmount:    { type: Number, required: [true, 'Total amount is required'], min: [0, 'Cannot be negative'] },

    // Delivery
    deliveryType: {
      type: String,
      enum: { values: ['standard', 'express', 'same_day'], message: 'Invalid delivery type' },
      default: 'standard',
    },
    estimatedDelivery: { type: Date, default: null },
    deliveredAt:       { type: Date, default: null },

    // Payment
    paymentMethod: {
      type:     String,
      enum:     { values: ['cod', 'online', 'wallet'], message: 'Invalid payment method' },
      required: [true, 'Payment method is required'],
    },
    paymentStatus: {
      type:    String,
      enum:    { values: ['pending', 'paid', 'failed', 'refunded'], message: 'Invalid payment status' },
      default: 'pending',
      index:   true,
    },
    razorpayOrderId:   { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },

    // Status
    status: {
      type: String,
      enum: {
        values: ['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
        message: 'Invalid order status',
      },
      default: 'placed',
      index:   true,
    },

    // embedded — max ~8-10 entries, always read with Order
    statusHistory: {
      type:    [statusHistorySchema],
      default: [],
    },

    // Cancellation
    cancelReason: { type: String, default: null, maxlength: 500 },
    cancelledBy:  { type: String, enum: ['user', 'admin', 'system'], default: null },
    cancelledAt:  { type: Date,   default: null },

    overdueAlertSentAt: { type: Date, default: null },
    notes:              { type: String, default: null, maxlength: 500 },
    adminNotes:         { type: String, default: null, maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// Indexes
// user order history page (newest first)
orderSchema.index({ user: 1, createdAt: -1 });
// filtered user order list (e.g. pending orders)
orderSchema.index({ user: 1, status: 1 });
// admin: all orders by status + date
orderSchema.index({ status: 1, createdAt: -1 });
// delivery overdue check
orderSchema.index({ estimatedDelivery: 1, status: 1 });
// payment reconciliation
orderSchema.index({ razorpayOrderId: 1 });
orderSchema.index({ razorpayPaymentId: 1 });

// Middleware
orderSchema.pre('save', function () {
  if (!this.orderNumber) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yy}${mm}${dd}`;
    this.orderNumber = `ORD-OCN${dateStr}${nanoid(6).toUpperCase()}`;
  }

  if (this.isModified('status') && this.status === 'delivered' && !this.deliveredAt) {
    this.deliveredAt = new Date();
  }

  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({ status: 'placed', changedBy: 'system', note: null });
  }
});

// Virtuals
orderSchema.virtual('isCancellable').get(function () {
  return !['delivered', 'cancelled', 'refunded'].includes(this.status);
});

orderSchema.virtual('daysUntilDelivery').get(function () {
  if (!this.estimatedDelivery || ['delivered', 'cancelled'].includes(this.status)) return null;
  const diff = this.estimatedDelivery - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

orderSchema.virtual('isOverdue').get(function () {
  if (!this.estimatedDelivery) return false;
  if (['delivered', 'cancelled', 'refunded'].includes(this.status)) return false;
  return new Date() > this.estimatedDelivery;
});

orderSchema.virtual('overdueByDays').get(function () {
  if (!this.isOverdue) return 0;
  const diff = new Date() - this.estimatedDelivery;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Static Methods
// paginated list of orders for a user; items fetched separately via OrderItem.getByOrder(orderId)
orderSchema.statics.getUserOrders = function (userId, { page = 1, limit = 10, status } = {}) {
  const filter = { user: userId };
  if (status) filter.status = status;

  return this.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('-adminNotes -__v')
    .lean();
};

// orders past estimated delivery and not yet terminal
orderSchema.statics.getOverdueOrders = function () {
  return this.find({
    estimatedDelivery: { $lt: new Date() },
    status: { $nin: ['delivered', 'cancelled', 'refunded'] },
  })
    .populate('user', 'fullName email phone')
    .sort({ estimatedDelivery: 1 })
    .lean();
};

// Instance Methods
// cancel this order
orderSchema.methods.cancel = function (reason = '', cancelledBy = 'user', session = null) {
  if (!this.isCancellable) {
    throw new Error(`Order in terminal state "${this.status}" cannot be cancelled`);
  }

  this.status       = 'cancelled';
  this.cancelReason = reason;
  this.cancelledBy  = cancelledBy;
  this.cancelledAt  = new Date();

  this.statusHistory.push({ status: 'cancelled', note: reason || null, changedBy: cancelledBy });

  return session ? this.save({ session }) : this.save();
};

// advance order status with guard-railed transition rules
// vendors follow strict linear flow; admins have extended permissions
orderSchema.methods.updateStatus = function (newStatus, note = null, changedBy = 'vendor') {
  const VALID_TRANSITIONS = {
    placed:           ['confirmed'],
    confirmed:        ['processing'],
    processing:       ['shipped'],
    shipped:          ['out_for_delivery'],
    out_for_delivery: ['delivered'],
    delivered:        [],
    cancelled:        [],
    refunded:         [],
  };

  const ADMIN_TRANSITIONS = {
    placed:           ['confirmed', 'cancelled'],
    confirmed:        ['processing', 'cancelled'],
    processing:       ['shipped',   'cancelled'],
    shipped:          ['out_for_delivery', 'cancelled'],
    out_for_delivery: ['delivered', 'cancelled'],
    delivered:        ['refunded'],
    cancelled:        ['refunded'],
    refunded:         [],
  };

  const allowed = changedBy === 'admin'
    ? ADMIN_TRANSITIONS[this.status] || []
    : VALID_TRANSITIONS[this.status] || [];

  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot transition from "${this.status}" to "${newStatus}". Allowed: [${allowed.join(', ') || 'none'}]`
    );
  }

  this.status = newStatus;
  this.statusHistory.push({ status: newStatus, note: note || null, changedBy });

  return this.save();
};

const Order = mongoose.model('Order', orderSchema);

export default Order;