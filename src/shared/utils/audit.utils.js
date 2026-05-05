import AuditLog from '../models/audit-log.model.js';

/**
 * Creates an audit log entry
 * 
 * @param {Object} req - Express request object (to extract user and metadata)
 * @param {Object} options - Log details
 * @param {string} options.action - Action name (e.g. 'BLOCK_USER', 'APPROVE_PRODUCT')
 * @param {string} options.resourceType - Type of resource affected
 * @param {string} options.resourceId - ID of resource affected
 * @param {Object} [options.changes] - Object containing before/after state
 * @param {string} [options.details] - Human readable description
 */
export const createAuditLog = async (req, options) => {
    try {
        const { action, resourceType, resourceId, changes, details } = options;
        
        await AuditLog.create({
            user: req.user?._id,
            role: req.user?.role || 'system',
            action,
            resourceType,
            resourceId,
            changes,
            details,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });
    } catch (error) {
        // We don't want to crash the main request if logging fails, but we should log the failure
        console.error('[AUDIT_LOG_ERROR]:', error.message);
    }
};
