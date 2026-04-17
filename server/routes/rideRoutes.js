const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const Ride = require("../models/Ride");
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");
const calculateFare = require("../utils/fareCalculator");
const SystemSetting = require("../models/SystemSetting");
const { protect } = require("../middleware/authMiddleware");
const rideController = require("../controllers/rideController");
const SocketService = require("../services/SocketService");
const AuditLog = require("../models/AuditLog");

/**
 * @route   GET /api/rides/my-rides
 * @desc    Get history for logged-in user
 */
router.get("/my-rides", protect, rideController.getMyRides);

// --- SETTINGS ENDPOINTS ---

/**
 * @route   GET /api/rides/settings/auto-accept
 * @desc    Get the current Auto-Accept status
 */
router.get("/settings/auto-accept", async (req, res) => {
  try {
    let setting = await SystemSetting.findOne({ key: "autoAccept" });
    if (!setting) {
      setting = await SystemSetting.create({ key: "autoAccept", value: false });
    }
    res.json({ autoAccept: setting.value });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   POST /api/rides/settings/auto-accept
 * @desc    Toggle Auto-Accept
 */
router.post("/settings/auto-accept", async (req, res) => {
  try {
    const { autoAccept } = req.body;
    const setting = await SystemSetting.findOneAndUpdate(
      { key: "autoAccept" },
      { value: autoAccept },
      { new: true, upsert: true },
    );
    res.json({ autoAccept: setting.value });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Auto-Seed Fleet ---
const seedFleet = async () => {
  try {
    const count = await Vehicle.countDocuments();
    if (count === 0) {
      console.log("🔧 Seeding Initial Fleet...");
      await Vehicle.create([
        { name: "Van 1", type: "Large Van", capacity: 5 },
        { name: "Van 2", type: "Large Van", capacity: 5 },
        { name: "Van 3", type: "Large Van", capacity: 5 },
        { name: "Van 4", type: "Large Van", capacity: 5 },
        { name: "Van 5", type: "Large Van", capacity: 5 },
        { name: "Car 1", type: "Small Car", capacity: 2 },
        { name: "Car 2", type: "Small Car", capacity: 2 },
      ]);
      console.log("✅ Fleet Seeded Checked");
    }
  } catch (err) {
    console.error("Fleet Seed Error:", err);
  }
};
seedFleet();

// --- TICKET MIGRATION: Backfill Old Rides ---
const seedTicketIds = async () => {
  try {
    const ridesWithoutTickets = await Ride.find({
      ticketId: { $exists: false },
    });
    if (ridesWithoutTickets.length > 0) {
      console.log(
        `🎫 Backfilling ${ridesWithoutTickets.length} Rides with IDs...`,
      );
      for (const ride of ridesWithoutTickets) {
        const randomChars = Math.random()
          .toString(36)
          .substring(2, 5)
          .toUpperCase();
        ride.ticketId = `ASH-${randomChars}`;
        await ride.save();
      }
      console.log("✅ Ticket Migration Complete");
    }
  } catch (err) {
    console.error("Ticket Migration Failed:", err);
  }
};
seedTicketIds();

/**
 * @route   GET /api/rides/check-capacity
 * @desc    DYNAMIC Resource-Based Fleet Logic
 */
router.get("/check-capacity", async (req, res) => {
  try {
    const { time, passengerCount } = req.query;
    if (!time) return res.status(400).json({ message: "Time is required" });

    const selectedTime = new Date(time);

    if (selectedTime < new Date()) {
      return res.json({
        isFull: true,
        isBusy: false,
        fleetUsage: "N/A",
        remainingSeats: 0,
        message: "Cannot book in the past",
      });
    }

    const windowStart = new Date(selectedTime);
    windowStart.setMinutes(0, 0, 0);
    const windowEnd = new Date(selectedTime);
    windowEnd.setMinutes(59, 59, 999);

    const activeFleet = await Vehicle.find({ status: "Active" });
    const TOTAL_VEHICLES = activeFleet.length;
    const TOTAL_SEATS = activeFleet.reduce((sum, v) => sum + v.capacity, 0);

    const activeRides = await Ride.find({
      status: "Confirmed",
      scheduledTime: { $gte: windowStart, $lte: windowEnd },
    });

    const confirmedBookingsCount = activeRides.length;
    const currentOccupiedSeats = activeRides.reduce(
      (acc, r) => acc + r.passengers,
      0,
    );
    const requestedSeats = parseInt(passengerCount) || 1;

    const allVehiclesBusy = TOTAL_VEHICLES - confirmedBookingsCount <= 0;
    const seatsFull = currentOccupiedSeats + requestedSeats > TOTAL_SEATS;
    const tooLargeForAnyVehicle = requestedSeats > 5;
    const isFull = allVehiclesBusy || seatsFull || tooLargeForAnyVehicle;
    const isBusy = confirmedBookingsCount >= TOTAL_VEHICLES - 2;

    res.json({
      isFull,
      isBusy,
      fleetUsage: `${confirmedBookingsCount}/${TOTAL_VEHICLES} Active Vehicles`,
      remainingSeats: TOTAL_SEATS - currentOccupiedSeats,
      message: isFull
        ? "Fleet Fully Dispatched"
        : isBusy
          ? "High Demand"
          : "Clear",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   POST /api/rides
 * @desc    Create a new ride request
 */
router.post("/", async (req, res) => {
  try {
    const {
      passengerName,
      phoneNumber,
      pickup,
      pickupDetails,
      pickupCoordinates,
      dropoff,
      dropoffCoordinates,
      userType,
      isSameDay,
      passengers,
      isOutOfTown,
      mileage,
      scheduledTime,
    } = req.body;

    if (
      !passengerName ||
      !phoneNumber ||
      !pickup ||
      !dropoff ||
      !scheduledTime
    ) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const bookingDate = new Date(scheduledTime);
    if (bookingDate < new Date()) {
      return res
        .status(400)
        .json({ message: "Cannot schedule rides in the past." });
    }

    const windowStart = new Date(bookingDate);
    windowStart.setMinutes(0, 0, 0);
    const windowEnd = new Date(bookingDate);
    windowEnd.setMinutes(59, 59, 999);

    const activeRidesCount = await Ride.countDocuments({
      status: { $in: ["Confirmed", "En-Route"] },
      scheduledTime: { $gte: windowStart, $lte: windowEnd },
    });

    const activeFleetCount = await Vehicle.countDocuments({ status: "Active" });

    if (activeRidesCount >= activeFleetCount) {
      console.warn(`⚠️ Blocked Overbooking Attempt at ${scheduledTime}`);
      return res.status(409).json({
        message:
          "High Demand: This slot was just filled by another rider. Please choose a different time.",
      });
    }

    const officialFare = calculateFare(
      userType,
      isSameDay,
      passengers,
      isOutOfTown,
      mileage,
    );

    const setting = await SystemSetting.findOne({ key: "autoAccept" });
    const autoAccept = setting ? setting.value : false;
    const initialStatus = autoAccept ? "Confirmed" : "Pending";

    const randomChars = Math.random()
      .toString(36)
      .substring(2, 5)
      .toUpperCase();
    const ticketId = `ASH-${randomChars}`;

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const newRide = new Ride({
        passengerName,
        phoneNumber,
        pickup,
        pickupDetails,
        pickupCoordinates,
        dropoff,
        dropoffCoordinates,
        userType,
        isSameDay,
        passengers,
        isOutOfTown,
        mileage,
        fare: officialFare,
        scheduledTime: bookingDate,
        riderId: req.body.riderId,
        status: initialStatus,
        ticketId: ticketId,
        logs: [
          {
            user: "System",
            action: "Ride Requested",
            details: `Via Web Portal. Initial Status: ${initialStatus}`,
          },
        ],
      });

      await newRide.save({ session });
      await session.commitTransaction();

      res.status(201).json(newRide);
      SocketService.emitRideUpdate(newRide);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (err) {
    console.error("Booking Error:", err);
    res.status(500).json({ message: "Server Error during booking." });
  }
});

/**
 * @route   GET /api/rides
 */
router.get("/", async (req, res) => {
  try {
    const rides = await Ride.find().sort({ scheduledTime: 1 });
    res.json(rides);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   PATCH /api/rides/:id/status
 * @desc    Update Status + Log Action (Protected) + REVENUE LOCK
 */
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const { status, dispatcherNotes } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) return res.status(404).json({ message: "Ride not found" });

    const updateData = { status, dispatcherNotes };

    if (status === "Completed" && ride.status !== "Completed") {
      updateData.finalizedFare = ride.fare;
      updateData.paymentStatus = "Invoiced";
    }

    const logEntry = {
      user: req.user.username || "Dispatcher",
      action: `Changed Status: ${ride.status} > ${status}`,
      details: dispatcherNotes ? `Note: ${dispatcherNotes}` : "",
    };

    const updatedRide = await Ride.findByIdAndUpdate(
      req.params.id,
      {
        $set: updateData,
        $push: { logs: logEntry },
      },
      { new: true },
    );

    await AuditLog.create({
      action: "STATUS_CHANGE",
      performedBy: req.user.username || "Dispatcher",
      targetId: ride._id,
      targetModel: "Ride",
      changes: { from: ride.status, to: status },
      metadata: dispatcherNotes,
    });

    res.json(updatedRide);
    SocketService.emitRideUpdate(updatedRide);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * @route   PATCH /api/rides/:id/vehicle
 */
router.patch("/:id/vehicle", async (req, res) => {
  try {
    const { assignedVehicle } = req.body;
    const updatedRide = await Ride.findByIdAndUpdate(
      req.params.id,
      { assignedVehicle },
      { new: true },
    );

    if (!updatedRide)
      return res.status(404).json({ message: "Ride not found" });
    res.json(updatedRide);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * @route   PATCH /api/rides/:id/details
 * @desc    Edit Ride Details (Time/Fare)
 */
router.patch("/:id/details", async (req, res) => {
  try {
    const { fare, scheduledTime } = req.body;

    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.finalizedFare !== undefined && fare !== undefined) {
      return res
        .status(403)
        .json({
          message: "Billing Locked: Cannot edit fare of a completed ride.",
        });
    }

    const updates = {};
    if (fare !== undefined) updates.fare = fare;
    if (scheduledTime) updates.scheduledTime = new Date(scheduledTime);

    const updatedRide = await Ride.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    res.json(updatedRide);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * @route   GET /api/rides/vehicles
 * @desc    Get complete fleet status for Fleet Manager
 */
router.get("/vehicles", async (req, res) => {
  try {
    const vehicles = await Vehicle.find().sort({ status: 1, name: 1 });
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   GET /api/rides/:id
 * @desc    Get single ride details by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   PATCH /api/rides/vehicles/:id
 * @desc    Toggle Vehicle Maintenance Status
 */
router.patch("/vehicles/:id", async (req, res) => {
  try {
    const { status, assignedDriver } = req.body;

    const updates = {};
    if (status) updates.status = status;
    if (assignedDriver !== undefined) updates.assignedDriver = assignedDriver;

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true },
    );
    res.json(updatedVehicle);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// RIDER: Track Ride by Ticket ID (Public Safe Endpoint)
router.get("/track/:ticketId", async (req, res) => {
  try {
    const ride = await Ride.findOne({ ticketId: req.params.ticketId }).select(
      "ticketId status passengerName pickup pickupDetails dropoff scheduledTime fare assignedVehicle userType passengers",
    );

    if (!ride) return res.status(404).json({ message: "Ticket not found" });
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- ADMIN ENDPOINTS (Reporting) ---

/**
 * @route   GET /api/rides/admin/audit-logs
 * @desc    Fetch recent audit logs (Protected)
 */
router.get("/admin/audit-logs", protect, async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// FLEET TRACKING ENDPOINTS (Phase 1 — Live Map Command Center)
// ============================================================

/**
 * @route   GET /api/rides/fleet/drivers
 * @desc    Get all drivers with current locations, status, assigned vehicle, and active ride
 * @access  Protected (Dispatcher)
 */
router.get("/fleet/drivers", protect, async (req, res) => {
  try {
    const drivers = await User.find({
      role: { $regex: /^driver$/i },
      isSuspended: { $ne: true },
    }).select("-password");

    const enrichedDrivers = await Promise.all(
      drivers.map(async (driver) => {
        const vehicle = await Vehicle.findOne({
          assignedDriver: driver.username,
        });
        const activeRide = vehicle
          ? await Ride.findOne({
              assignedVehicle: vehicle.name,
              status: { $in: ["Confirmed", "En-Route"] },
            })
          : null;

        return {
          _id: driver._id,
          username: driver.username,
          fullName: driver.fullName || driver.username,
          phoneNumber: driver.phoneNumber || "",
          licenseNumber: driver.licenseNumber || "",
          profilePhoto: driver.profilePhoto || "",
          status: driver.status || "Idle",
          currentLocation: driver.currentLocation || {
            type: "Point",
            coordinates: [0, 0],
          },
          lastLocationUpdate: driver.lastLocationUpdate || null,
          tags: driver.tags || [],
          assignedVehicle: vehicle
            ? {
                _id: vehicle._id,
                name: vehicle.name,
                type: vehicle.type,
                licensePlate: vehicle.licensePlate || "",
                capacity: vehicle.capacity,
              }
            : null,
          activeRide: activeRide
            ? {
                _id: activeRide._id,
                ticketId: activeRide.ticketId,
                status: activeRide.status,
                passengerName: activeRide.passengerName,
                pickup: activeRide.pickup,
                dropoff: activeRide.dropoff,
                scheduledTime: activeRide.scheduledTime,
                passengers: activeRide.passengers,
                fare: activeRide.fare,
              }
            : null,
        };
      }),
    );

    res.json(enrichedDrivers);
  } catch (err) {
    console.error("Fleet drivers fetch error:", err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   GET /api/rides/fleet/active-rides
 * @desc    Get all active rides for map display
 * @access  Protected (Dispatcher)
 */
router.get("/fleet/active-rides", protect, async (req, res) => {
  try {
    const activeRides = await Ride.find({
      status: { $in: ["Pending", "Confirmed", "En-Route"] },
    }).sort({ scheduledTime: 1 });

    res.json(activeRides);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   POST /api/rides/fleet/driver-location
 * @desc    REST endpoint for driver GPS update (mobile app fallback)
 * @access  Protected (Driver)
 */
router.post("/fleet/driver-location", protect, async (req, res) => {
  try {
    const { coordinates } = req.body;
    if (
      !coordinates ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2
    ) {
      return res
        .status(400)
        .json({ message: "Valid coordinates [lng, lat] required" });
    }

    const user = await User.findById(req.user.id).select("username");
    if (!user) return res.status(404).json({ message: "User not found" });

    await User.findByIdAndUpdate(req.user.id, {
      currentLocation: { type: "Point", coordinates },
      lastLocationUpdate: new Date(),
    });

    const driverVehicle = await Vehicle.findOneAndUpdate(
      { assignedDriver: user.username },
      { currentLocation: { type: "Point", coordinates } },
      { new: true },
    );

    const activeRide = driverVehicle
      ? await Ride.findOne({
          assignedVehicle: driverVehicle.name,
          status: { $in: ["Confirmed", "En-Route"] },
        }).select("_id riderId")
      : null;

    if (activeRide?._id) {
      await Ride.findByIdAndUpdate(activeRide._id, {
        driverCoordinates: { type: "Point", coordinates },
      });
    }

    SocketService.emitDriverLocation({
      driverId: req.user.id,
      driverUsername: user.username,
      coordinates,
      currentRideId: activeRide?._id || null,
      riderId: activeRide?.riderId || null,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
