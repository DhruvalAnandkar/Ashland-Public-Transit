const mongoose = require('mongoose');

/**
 * AuditLog Schema
 * "The Black Box" - Immutable records of all system actions.
 * No update/delete routes will ever be created for this model.
 */
const AuditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true
    },
    performedBy: {
        type: String, // Username or User ID
        default: 'System'
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to Ride or Vehicle
        required: true
    },
    targetModel: {
        type: String, // 'Ride' or 'Vehicle'
        required: true
    },
    changes: {
        type: Object // JSON snapshot of what changed
    },
    metadata: {
        type: String // Extra notes
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }, // UpdatedAt is disabled implies immutability
    minimize: false
});

// Prevent modification (Mongoose Level Safety)
AuditLogSchema.pre('findOneAndUpdate', function (next) {
    next(new Error("AuditLogs are immutable."));
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
