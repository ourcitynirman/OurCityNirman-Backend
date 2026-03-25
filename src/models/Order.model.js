import mongoose from 'mongoose';
import { nanoid } from 'nanoid';


export const CATEGORY_DELIVERY_DAYS = {
    'Construction Materials':   10,
    'Finishing Materials':       7,
    'Plumbing & Sanitary Ware':  6,
    'Electrical Supplies':       5,
    'Wood & Furniture':          8,
    'Paints & Coatings':         5,
    'Kitchen Appliances':        6,
    'Hardware & Security':       5,
    'Other':                     7,
    'default':                   7,
};


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

const addressSnapshotSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true },
        phone:    { type: String, required: true },
        line1:    { type: String, required: true },
        line2:    { type: String, default: null },
        village:  { type: String, default: null },
        landmark: { type: String, default: null },
        city:     { type: String, required: true },
        state:    { type: String, required: true },
        pincode:  { type: String, required: true },
        country:  { type: String, default: 'India' },
    },
    { _id: false }
);

const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: [true, 'Product is required'],
        },
        vendor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Vendor is required'],
            index: true,
        },
        productSnapshot: {
            name:     { type: String, required: true },
            image:    { type: String, default: null },
            category: { type: String },
            brand:    { type: String },
        },
        quantity:   { type: Number, required: true, min: 1 },
        price:      { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },

        itemStatus: {
            type: String,
            enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
            default: 'pending',
        },

        trackingNumber:  { type: String, default: null },
        shippingCarrier: { type: String, default: null },
    },
    { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
    {
        status: {
            type: String,
            required: true,
            enum: ['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
        },
        changedAt: { type: Date, default: Date.now },
        note:      { type: String, default: null, maxlength: 300 },
        changedBy: {
            type: String,
            enum: ['user', 'vendor', 'admin', 'system'],
            default: 'system',
        },
    },
    { _id: false }
);

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

        items: {
            type: [orderItemSchema],
            validate: {
                validator: (v) => v.length > 0,
                message:   'Order must have at least one item',
            },
        },

        deliveryAddress: {
            type:     addressSnapshotSchema,
            required: true,
        },

        subtotal:       { type: Number, required: true, min: 0 },
        deliveryType: {
            type: String,
            enum: ['standard', 'express', 'same_day'],
            default: 'standard'
        },
        deliveryCharge: { type: Number, default: 0, min: 0 },
        discount:       { type: Number, default: 0, min: 0 },
        totalAmount:    { type: Number, required: true, min: 0 },

        paymentMethod: {
            type: String,
            enum:     { values: ['cod', 'online', 'wallet'], message: 'Invalid payment method' },
            required: true,
        },
        paymentStatus: {
            type:    String,
            enum:    { values: ['pending', 'paid', 'failed', 'refunded'], message: 'Invalid payment status' },
            default: 'pending',
        },

        razorpayOrderId:   { type: String, default: null },
        razorpayPaymentId: { type: String, default: null },

        status: {
            type: String,
            enum: {
                values: ['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
                message: 'Invalid order status',
            },
            default: 'placed',
            index:   true,
        },

        statusHistory: {
            type:    [statusHistorySchema],
            default: [],
        },

        cancelReason: { type: String, default: null, maxlength: 500 },
        cancelledBy:  { type: String, enum: ['user', 'admin', 'system'], default: null },
        cancelledAt:  { type: Date, default: null },

        estimatedDelivery: { type: Date, default: null },
        deliveredAt:       { type: Date, default: null },

        overdueAlertSentAt: { type: Date, default: null },

        notes:      { type: String, default: null, maxlength: 500 },
        adminNotes: { type: String, default: null, maxlength: 1000 },
    },
    {
        timestamps: true,
        toJSON:     { virtuals: true },
        toObject:   { virtuals: true },
    }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ 'items.vendor': 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ estimatedDelivery: 1, status: 1 }); 

orderSchema.pre('save', function (next) {
    if (!this.orderNumber) {
        this.orderNumber = 'ORD-' + nanoid(10).toUpperCase();
    }

    if (this.isModified('status') && this.status === 'delivered' && !this.deliveredAt) {
        this.deliveredAt = new Date();
    }

    if (this.isNew && this.statusHistory.length === 0) {
        this.statusHistory.push({
            status:    'placed',
            changedBy: 'system',
            note:      null,
        });
    }

    next();
});


orderSchema.virtual('isCancellable').get(function () {
    return ['placed', 'confirmed'].includes(this.status);
});

orderSchema.virtual('totalItems').get(function () {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
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

orderSchema.statics.getOverdueOrders = function () {
    return this.find({
        estimatedDelivery: { $lt: new Date() },
        status: { $nin: ['delivered', 'cancelled', 'refunded'] },
    })
        .populate('user', 'name email phone')
        .sort({ estimatedDelivery: 1 })
        .lean();
};


orderSchema.methods.cancel = function (reason = '', cancelledBy = 'user', session = null) {
    if (!['placed', 'confirmed'].includes(this.status)) return null;

    this.status       = 'cancelled';
    this.cancelReason = reason;
    this.cancelledBy  = cancelledBy; 
    this.cancelledAt  = new Date();

    this.statusHistory.push({
        status:    'cancelled',
        note:      reason || null,
        changedBy: cancelledBy,
    });

    return session ? this.save({ session }) : this.save();
};

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
        processing:       ['shipped', 'cancelled'],
        shipped:          ['out_for_delivery', 'cancelled'],
        out_for_delivery: ['delivered', 'cancelled'],
        delivered:        ['refunded'],
        cancelled:        ['refunded'],
        refunded:         [],
    };

    const allowed =
        changedBy === 'admin'
            ? ADMIN_TRANSITIONS[this.status] || []
            : VALID_TRANSITIONS[this.status] || [];

    if (!allowed.includes(newStatus)) {
        throw new Error(
            `Cannot update status from "${this.status}" to "${newStatus}". Allowed transitions: [${allowed.join(', ') || 'none'}]`
        );
    }

    this.status = newStatus;
    this.statusHistory.push({ status: newStatus, note: note || null, changedBy });

    return this.save();
};

orderSchema.methods.getVendorItems = function (vendorId) {
    return this.items.filter(
        (item) => item.vendor.toString() === vendorId.toString()
    );
};

const Order = mongoose.model('Order', orderSchema);

export default Order;