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
    pushToken: {
        type: String,
        required: false
    },
    walletBalance: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
