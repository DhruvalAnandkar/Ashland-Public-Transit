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
    features: [{
        type: String // e.g., 'wheelchair_lift', 'stretcher'
    }],
    status: {
        type: String,
        enum: ['Active', 'In Shop', 'Retired'],
        default: 'Active'
    },
    // --- IDENTIFICATION ---
    licensePlate: {
        type: String,
        default: ''
    },
    // --- ASSIGNMENT TRACKING ---
    assignedDriver: {
        type: String,
        default: null // Username of the driver
    },
    // --- LIVE LOCATION (mirrored from driver for quick fleet queries) ---
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0] // [longitude, latitude]
        }
    },
    // --- MAINTENANCE TRACKING ---
    engineHours: {
        type: Number,
        default: 0
    },
    lastServiceDate: {
        type: Date
    },
    maintenanceHistory: [{
        type: { type: String, required: true },
        date: { type: Date, default: Date.now },
        cost: { type: Number, default: 0 },
        notes: String,
        mileage: { type: Number, default: 0 },
        performedBy: { type: String, default: '' },
        engineHoursAtService: Number
    }]
}, { timestamps: true });

module.exports = mongoose.model('Vehicle', VehicleSchema);
