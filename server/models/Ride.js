const mongoose = require("mongoose");

/**
 * Ride Schema - Resource Management Version
 * This model tracks passenger requests and physical vehicle assignments
 * for the Ashland Public Transit Fleet (7 Vehicles Total).
 */
const RideSchema = new mongoose.Schema(
  {
    // 1. Core Passenger Data
    passengerName: {
      type: String,
      required: [true, "Passenger name is required for the manifest"],
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for now to support legacy guests
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required for dispatch communication"],
    },

    // 1b. Digital Ticketing (Expert Feature)
    ticketId: {
      type: String,
      unique: true,
    },

    // 2. Location Logic
    pickup: { type: String, required: true },
    pickupCoordinates: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] }, // [longitude, latitude]
    },
    pickupDetails: { type: String }, // "Last 100 Feet" precision
    dropoff: { type: String, required: true },
    dropoffCoordinates: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] }, // [longitude, latitude]
    },
    driverCoordinates: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] }, // [longitude, latitude]
    },
    isOutOfTown: { type: Boolean, default: false },
    mileage: { type: Number, default: 0 },

    // 3. Trip Logic
    userType: {
      type: String,
      enum: [
        "General",
        "Standard",
        "Senior",
        "Student",
        "Veteran",
        "Elderly/Disabled",
        "Child",
      ], // Expanded Enums - added "General" for mobile app compatibility
      required: true,
    },
    isSameDay: { type: Boolean, default: false },
    passengers: {
      type: Number,
      default: 1,
      min: [1, "At least one passenger is required"],
      max: [5, "Groups larger than 5 require a special high-capacity request"],
    },
    accessibility: {
      type: Boolean,
      default: false,
    },
    estimatedPrice: {
      type: Number,
    },

    passengerDetails: {
      adults: { type: Number, default: 1 },
      children: { type: Number, default: 0 },
      elderly: { type: Number, default: 0 },
    },

    // 4. Financial Tracking & Billing (Phase 3)
    fare: { type: Number, required: true },
    fareType: {
      type: String,
      enum: ["SameDay", "Scheduled", "Elderly", "Standard"],
      default: "SameDay",
    },
    finalizedFare: { type: Number }, // LOCKED Revenue
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Invoiced"],
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Digital Pass", "Account"],
      default: "Cash",
    },

    // 5. Dispatcher Control Logic
    // Enum aligned with all runtime values used across server routes, client, and mobile.
    // 'Pending'   — Ride requested, awaiting dispatcher review (default)
    // 'Confirmed' — Dispatcher approved, vehicle assigned
    // 'En-Route'  — Driver has started the trip
    // 'Completed' — Trip finished; triggers revenue lock (finalizedFare)
    // 'Cancelled' — Emergency cancel by dispatcher; frees fleet capacity
    // 'Rejected'  — Dispatcher declined the request
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "En-Route",
        "Completed",
        "Cancelled",
        "Rejected",
      ],
      default: "Pending",
    },

    // 6. AUDIT TRAIL (Liz's Request)
    logs: [
      {
        user: String, // e.g. "Dispatcher", "Admin", "System"
        action: String, // e.g. "Confirmed Ride"
        timestamp: { type: Date, default: Date.now },
        details: String,
      },
    ],

    // 7. FLEET OPTIMIZATION FIELD
    // This allows Liz to "Shuffle" passengers to the most efficient vehicle
    // Relaxed validation to allow specific vehicle names (e.g. "Bus 101")
    assignedVehicle: {
      type: String,
      default: "Unassigned",
    },

    dispatcherNotes: { type: String },

    // 8. Scheduling
    scheduledTime: {
      type: Date,
      required: [true, "A specific date and time is required for scheduling"],
    },
  },
  {
    timestamps: true, // Automatically tracks 'Created At' and 'Updated At'
  },
);

// Expert Indexing: Helps the Dashboard load faster when Liz has hundreds of rides
RideSchema.index({ scheduledTime: 1, status: 1 });

module.exports = mongoose.model("Ride", RideSchema);
