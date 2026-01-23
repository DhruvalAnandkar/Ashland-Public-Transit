const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema({
    // Simplified to String because we don't have a User Login system yet
    passengerName: { type: String, required: true }, 
    
    // Simplified from objects to strings for the MVP
    pickup: { type: String, required: true },
    dropoff: { type: String, required: true },
    
    // Matches the "userType" from your Frontend state
    userType: { 
        type: String, 
        enum: ['General', 'Elderly/Disabled'], 
        required: true 
    },
    
    isSameDay: { type: Boolean, default: false },
    passengers: { type: Number, default: 1 },
    
    // Changed from estimatedFare/actualFare to just 'fare' to match frontend
    fare: { type: Number, required: true },
    
    status: { 
        type: String, 
        enum: ['Requested', 'Confirmed', 'En-Route', 'Completed', 'No-Show'], 
        default: 'Requested' 
    },
    
    scheduledTime: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Ride', RideSchema);