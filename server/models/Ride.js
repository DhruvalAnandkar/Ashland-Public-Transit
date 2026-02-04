const mongoose = require('mongoose');

/**
 * Ride Schema - Resource Management Version
 * This model tracks passenger requests and physical vehicle assignments
 * for the Ashland Public Transit Fleet (7 Vehicles Total).
 */
const RideSchema = new mongoose.Schema({
    // 1. Core Passenger Data
    passengerName: {
        type: String,
        required: [true, 'Passenger name is required for the manifest']
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required for dispatch communication']
    },

    // 1b. Digital Ticketing (Expert Feature)
    ticketId: {
        type: String,
        unique: true
    },

    // 2. Location Logic
    pickup: { type: String, required: true },
    pickupDetails: { type: String }, // "Last 100 Feet" precision
    dropoff: { type: String, required: true },
    isOutOfTown: { type: Boolean, default: false },
    mileage: { type: Number, default: 0 },

    // 3. Trip Logic
    userType: {
        type: String,
        enum: ['General', 'Elderly/Disabled', 'Child'],
        required: true
    },
    isSameDay: { type: Boolean, default: false },
    passengers: {
        type: Number,
        default: 1,
        min: [1, 'At least one passenger is required'],
        max: [5, 'Groups larger than 5 require a special high-capacity request']
    },

    // 4. Financial Tracking
    fare: { type: Number, required: true },

    // 5. Dispatcher Control Logic
    // Starts at 'Pending Review' to solve the 'Automatic Acceptance' fear Liz mentioned.
    status: {
        type: String,
        enum: [
            'Pending Review',
            'Confirmed',
            'Rejected',
            'En-Route',
            'Completed',
            'No-Show',
            'Cancelled'
        ],
        default: 'Pending Review'
    },

    // 6. FLEET OPTIMIZATION FIELD
    // This allows Liz to "Shuffle" passengers to the most efficient vehicle
    // Relaxed validation to allow specific vehicle names (e.g. "Bus 101")
    assignedVehicle: {
        type: String,
        default: 'Unassigned'
    },

    dispatcherNotes: { type: String },

    // 7. Scheduling
    scheduledTime: {
        type: Date,
        required: [true, 'A specific date and time is required for scheduling']
    }
}, {
    timestamps: true // Automatically tracks 'Created At' and 'Updated At'
});

// Expert Indexing: Helps the Dashboard load faster when Liz has hundreds of rides
RideSchema.index({ scheduledTime: 1, status: 1 });

module.exports = mongoose.model('Ride', RideSchema);