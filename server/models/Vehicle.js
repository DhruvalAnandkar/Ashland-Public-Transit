const mongoose = require('mongoose');

/**
 * Vehicle Schema
 * Core asset for the new "Dynamic Fleet-Lock" logic.
 * Allows Dispatch to mark vehicles as 'In Shop' to reduce capacity.
 */
const VehicleSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        unique: true 
    },
    type: { 
        type: String, 
        enum: ['Large Van', 'Small Car'], 
        required: true 
    },
    capacity: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'In Shop'],
        default: 'Active'
    }
}, { timestamps: true });

module.exports = mongoose.model('Vehicle', VehicleSchema);
