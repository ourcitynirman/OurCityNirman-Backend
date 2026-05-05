import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    role: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        index: true
    },
    resourceType: {
        type: String,
        required: true,
        enum: ['User', 'Product', 'Order', 'Shop', 'Category', 'Brand', 'System'],
        index: true
    },
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    changes: {
        before: { type: mongoose.Schema.Types.Mixed },
        after: { type: mongoose.Schema.Types.Mixed }
    },
    details: {
        type: String
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
}, {
    timestamps: true
});

// Optimization: Index for date range filtering
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
