import mongoose from 'mongoose';

const commissionSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true,
    },

    // line-item level granularity (if order splits per item)
    order_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderItem',
      default: null,
    },

    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vendor reference is required'],
      index: true,
    },

    // worker assigned to a service-type commission
    worker_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // transport partner assigned to this commission
    transport_provider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // type of transaction this commission applies to
    commission_type: {
      type: String,
      enum: {
        values: ['product', 'service', 'transport'],
        message: 'commission_type must be product, service, or transport',
      },
      required: [true, 'Commission type is required'],
    },

    // percentage = % of base_amount, fixed = flat fee
    commission_basis: {
      type: String,
      enum: {
        values: ['percentage', 'fixed'],
        message: 'commission_basis must be percentage or fixed',
      },
      required: [true, 'Commission basis is required'],
    },

    // percentage value (e.g. 5) or fixed amount (e.g. 50)
    commission_rate: {
      type: Number,
      required: [true, 'Commission rate is required'],
      min: [0, 'Commission rate cannot be negative'],
    },

    // amount on which commission is calculated (e.g. item subtotal)
    base_amount: {
      type: Number,
      required: [true, 'Base amount is required'],
      min: [0, 'Base amount cannot be negative'],
    },

    // commission before GST
    commission_amount: {
      type: Number,
      required: [true, 'Commission amount is required'],
      min: [0, 'Commission amount cannot be negative'],
    },

    // GST applicable on the commission itself
    gst_rate: {
      type: Number,
      default: 0,
      min: [0, 'GST rate cannot be negative'],
      max: [100, 'GST rate cannot exceed 100'],
    },

    gst_amount: {
      type: Number,
      default: 0,
      min: [0, 'GST amount cannot be negative'],
    },

    // commission_amount + gst_amount
    total_commission_amount: {
      type: Number,
      required: [true, 'Total commission amount is required'],
      min: [0, 'Total commission amount cannot be negative'],
    },

    payment_status: {
      type: String,
      enum: {
        values: ['pending', 'deducted', 'paid', 'reversed'],
        message: 'payment_status must be pending, deducted, paid, or reversed',
      },
      default: 'pending',
      index: true,
    },

    // external settlement batch reference (e.g. Razorpay settlement ID)
    settlement_id: {
      type: String,
      default: null,
      trim: true,
    },

    // invoice reference for this commission transaction
    invoice_id: {
      type: String,
      default: null,
      trim: true,
    },

    // amount reversed/adjusted in case of refund
    refund_adjustment_amount: {
      type: Number,
      default: 0,
      min: [0, 'Refund adjustment cannot be negative'],
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Remarks cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
commissionSchema.index({ vendor_id: 1, payment_status: 1 });
commissionSchema.index({ order_id: 1, commission_type: 1 });
commissionSchema.index({ settlement_id: 1 });

// Static Methods
commissionSchema.statics.getPendingCommissions = function () {
  return this.find({ payment_status: 'pending' });
};

commissionSchema.statics.getByVendor = function (vendorId, status = null) {
  const query = { vendor_id: vendorId };
  if (status) query.payment_status = status;
  return this.find(query).sort({ createdAt: -1 });
};

commissionSchema.statics.getByOrder = function (orderId) {
  return this.find({ order_id: orderId });
};

// aggregate total pending commission amount across all vendors
commissionSchema.statics.getTotalPending = function () {
  return this.aggregate([
    { $match: { payment_status: 'pending' } },
    {
      $group: {
        _id: null,
        totalPending: { $sum: '$total_commission_amount' },
        count: { $sum: 1 },
      },
    },
  ]);
};

// Instance Methods

// mark as paid and optionally attach a settlement ID
commissionSchema.methods.markAsPaid = function (settlementId = null) {
  this.payment_status = 'paid';
  if (settlementId) this.settlement_id = settlementId;
  return this.save();
};

// reverse commission on order cancellation or refund
commissionSchema.methods.reverse = function (refundAmount = 0, remarks = '') {
  this.payment_status = 'reversed';
  this.refund_adjustment_amount = refundAmount;
  if (remarks) this.remarks = remarks;
  return this.save();
};

const Commission = mongoose.model('Commission', commissionSchema);

export default Commission;
