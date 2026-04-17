const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['Dispatcher', 'Admin', 'Rider', 'Driver'],
        default: 'Rider'
    },
    phoneNumber: {
        type: String,
        required: false
    },
    mobilityNeeds: [{
        type: String // Matches vehicle features e.g., 'wheelchair_lift'
    }],
    defaultPickupLocation: {
        type: String
    },
    pushToken: {
        type: String,
        required: false
    },
    walletBalance: {
        type: Number,
        default: 0
    },
    // --- DRIVER PROFILE ---
    fullName: {
        type: String,
        default: ''
    },
    licenseNumber: {
        type: String,
        default: ''
    },
    profilePhoto: {
        type: String,
        default: ''
    },
    // --- LIVE STATUS TRACKING ---
    status: {
        type: String,
        enum: ['Active', 'On Break', 'Off Duty', 'En-Route', 'Idle', 'Suspended'],
        default: 'Idle'
    },
    // --- LIVE LOCATION TRACKING ---
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
    lastLocationUpdate: {
        type: Date
    },
    // --- USER TAGS & MODERATION ---
    tags: [{
        type: String // 'VIP', 'Blocked', 'Senior', 'Veteran', 'Student'
    }],
    isSuspended: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

UserSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('User', UserSchema);
