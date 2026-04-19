const mongoose = require('mongoose');

const SavedPlaceSchema = new mongoose.Schema({
    label: { type: String, required: true },       // 'Home', 'Work', 'Gym'
    icon: { type: String, default: 'place' },      // home | work | star | place
    address: { type: String, required: true },
    coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    }
}, { _id: true, timestamps: true });

const PaymentMethodSchema = new mongoose.Schema({
    label: { type: String, required: true },       // 'Visa …4242', 'Cash', 'Transit Credits'
    brand: { type: String, default: 'Cash' },      // 'Visa' | 'Mastercard' | 'Cash' | 'Wallet'
    last4: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    provider: { type: String, default: 'manual' }, // 'stripe' | 'manual' | 'wallet'
}, { _id: true, timestamps: true });

const NotificationPrefsSchema = new mongoose.Schema({
    rideUpdates: { type: Boolean, default: true },
    driverArriving: { type: Boolean, default: true },
    promotions: { type: Boolean, default: false },
    receipts: { type: Boolean, default: true },
    serviceAlerts: { type: Boolean, default: true },
    smsEnabled: { type: Boolean, default: true },
    pushEnabled: { type: Boolean, default: true },
    emailEnabled: { type: Boolean, default: true }
}, { _id: false });

const PrivacyPrefsSchema = new mongoose.Schema({
    shareLiveLocation: { type: Boolean, default: true },
    shareRideWithContact: { type: Boolean, default: false },
    marketingOptIn: { type: Boolean, default: false }
}, { _id: false });

const AppPrefsSchema = new mongoose.Schema({
    language: { type: String, default: 'en' },
    theme: { type: String, enum: ['system', 'light', 'dark'], default: 'system' },
    distanceUnit: { type: String, enum: ['mi', 'km'], default: 'mi' },
    biometricEnabled: { type: Boolean, default: false }
}, { _id: false });

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

    // Contact
    email: { type: String, default: '', lowercase: true, trim: true, index: true },
    phoneNumber: { type: String, required: false },

    // Identity & Personal
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    fullName: { type: String, default: '' },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['', 'Male', 'Female', 'Non-binary', 'Prefer not to say'], default: '' },
    avatar: { type: String, default: '' },        // URL or base64
    profilePhoto: { type: String, default: '' },  // legacy driver field

    // APT rider classification (maps to fare engine)
    riderType: {
        type: String,
        enum: ['General', 'Senior', 'Elderly/Disabled', 'Student', 'Veteran', 'Child'],
        default: 'General'
    },
    dobVerified: { type: Boolean, default: false },
    disabilityVerified: { type: Boolean, default: false },
    veteranVerified: { type: Boolean, default: false },
    studentId: { type: String, default: '' },

    // Address
    homeAddress: { type: String, default: '' },

    // Accessibility / needs
    mobilityNeeds: [{ type: String }],
    accessibilityNotes: { type: String, default: '' },

    // Quick-book defaults
    defaultPickupLocation: { type: String },
    defaultPaymentMethodId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // Stored data
    savedPlaces: { type: [SavedPlaceSchema], default: [] },
    paymentMethods: { type: [PaymentMethodSchema], default: [] },

    // Emergency contact
    emergencyContact: {
        name: { type: String, default: '' },
        phone: { type: String, default: '' },
        relationship: { type: String, default: '' }
    },

    // Preferences
    notificationPrefs: { type: NotificationPrefsSchema, default: () => ({}) },
    privacyPrefs: { type: PrivacyPrefsSchema, default: () => ({}) },
    appPrefs: { type: AppPrefsSchema, default: () => ({}) },

    // Notifications / push
    pushToken: { type: String, required: false },

    // Financial
    walletBalance: { type: Number, default: 0 },

    // Password reset
    resetPasswordCode: { type: String, default: null },
    resetPasswordCodeExpires: { type: Date, default: null },
    resetPasswordAttempts: { type: Number, default: 0 },
    passwordChangedAt: { type: Date },

    // Driver fields
    licenseNumber: { type: String, default: '' },
    status: {
        type: String,
        enum: ['Active', 'On Break', 'Break', 'Off Duty', 'Offline', 'En-Route', 'Idle', 'Suspended'],
        default: 'Idle'
    },
    lastShiftStart: { type: Date },
    lastShiftEnd: { type: Date },
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    lastLocationUpdate: { type: Date },

    // Moderation
    tags: [{ type: String }],
    isSuspended: { type: Boolean, default: false },

    // Rider stats (maintained by server)
    stats: {
        totalRides: { type: Number, default: 0 },
        completedRides: { type: Number, default: 0 },
        cancelledRides: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 },
        noShowCount: { type: Number, default: 0 }
    },

    lastLoginAt: { type: Date }
}, { timestamps: true });

UserSchema.index({ currentLocation: '2dsphere' });

// Strip sensitive fields from JSON output
UserSchema.methods.toSafeJSON = function () {
    const obj = this.toObject({ virtuals: true });
    delete obj.password;
    delete obj.resetPasswordCode;
    delete obj.resetPasswordCodeExpires;
    delete obj.resetPasswordAttempts;
    return obj;
};

module.exports = mongoose.model('User', UserSchema);
