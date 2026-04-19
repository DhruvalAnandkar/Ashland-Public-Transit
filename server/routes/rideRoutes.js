const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const Ride = require("../models/Ride");
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");
const calculateFare = require("../utils/fareCalculator");
const {
  getFareBreakdown,
  getNoShowFee,
  normalizeUserType,
  IN_CITY_RATES,
  NO_SHOW_FEES,
} = require("../utils/fareCalculator");
const SystemSetting = require("../models/SystemSetting");
const { protect } = require("../middleware/authMiddleware");
const rideController = require("../controllers/rideController");
const SocketService = require("../services/SocketService");
const AuditLog = require("../models/AuditLog");
const Stripe = require("stripe");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const canUseMockPayments =
  process.env.ENABLE_MOCK_PAYMENTS === "true" || !process.env.STRIPE_SECRET_KEY;

const generateReceiptNumber = (rideId) =>
  `ASH-REC-${String(rideId).slice(-6).toUpperCase()}-${Date.now()
    .toString()
    .slice(-5)}`;

const requireDispatcherOrAdmin = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id).select("role username");
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }
    if (!["Dispatcher", "Admin"].includes(currentUser.role)) {
      return res.status(403).json({ message: "Dispatcher/Admin access only" });
    }
    req.currentUser = currentUser;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

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

const markRidePaid = async (ride, source = "Stripe Checkout") => {
  if (!ride || ride.paymentStatus === "Paid") {
    return ride;
  }

  const receiptNumber = generateReceiptNumber(ride._id);
  ride.paymentStatus = "Paid";
  ride.paymentMethod = "Stripe";
  ride.paidAt = new Date();
  ride.paymentReceiptNumber = receiptNumber;
  ride.paymentReceiptUrl = `/api/rides/track/${ride.ticketId}/receipt`;
  ride.logs.push({
    user: "System",
    action: "Payment Completed",
    details: `${source} marked payment as Paid.`,
  });
  ride.notifications.push({
    audience: "Rider",
    message: `Payment successful for ticket ${ride.ticketId}. Receipt ${receiptNumber} is ready.`,
  });
  ride.notifications.push({
    audience: "Dispatcher",
    message: `Payment successful for ${ride.ticketId}. Dispatcher can review rider/driver context.`,
  });

  await ride.save();

  await AuditLog.create({
    action: "PAYMENT_SUCCESS",
    performedBy: "System",
    targetId: ride._id,
    targetModel: "Ride",
    changes: { paymentStatus: "Paid", method: "Stripe" },
    metadata: `Ticket ${ride.ticketId}`,
  });

  SocketService.emitRideUpdate(ride);
  SocketService.emitDispatcherAlert({
    type: "PAYMENT_SUCCESS",
    severity: "info",
    ticketId: ride.ticketId,
    rideId: ride._id,
    message: `Payment completed for ${ride.passengerName} (${ride.ticketId}).`,
    timestamp: Date.now(),
  });

  return ride;
};

/**
 * @route   GET /api/rides/fare-info
 * @desc    Public APT rate card (for FareInfoScreen)
 */
router.get("/fare-info", (req, res) => {
  res.json({
    inCity: IN_CITY_RATES,
    noShow: {
      general: NO_SHOW_FEES.General,
      elderlyDisabled: NO_SHOW_FEES["Elderly/Disabled"],
    },
    hours: {
      weekdays: "6:00 AM – 9:00 PM",
      saturday: "8:00 AM – 6:00 PM",
      sunday: "Closed",
    },
    notes: {
      companion:
        "A 2nd rider going to the same destination as a General Public primary pays half of the primary fare.",
      childFree:
        "Children under 12 always ride FREE with a fare-paying adult.",
      scheduledCutoff:
        "Scheduled fare requires the booking to be made at least 24 hours in advance; otherwise same-day rates apply.",
    },
    contact: {
      phone: "(419) 207-8240",
      office: "(419) 289-8221",
      tddy: "711 (Ohio Relay)",
      address: "206 Claremont Avenue, Ashland, OH 44805",
    },
  });
});

/**
 * @route   POST /api/rides/estimate-fare
 * @desc    Official APT fare preview. Returns a detailed breakdown so
 *          the rider UI can render line-items that EXACTLY match what
 *          will be charged when the ride is created.
 */
router.post("/estimate-fare", (req, res) => {
  try {
    const {
      userType = "General",
      isSameDay = false,
      passengers = 1,
      childWithAdult = false,
      companions, // optional: [{ userType, childWithAdult? }, ...]
    } = req.body || {};

    const breakdown = getFareBreakdown({
      userType,
      isSameDay: !!isSameDay,
      passengers: Number(passengers) || 1,
      childWithAdult: !!childWithAdult,
      companions,
    });
    res.json(breakdown);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

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
      passengers,
      isOutOfTown,
      mileage,
      scheduledTime,
      paymentMethod,
      childWithAdult,
      companions,
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

    // APT rule: "Scheduled Ahead" is ≥ 24 hours in advance. Anything
    // booked inside the 24-hour window is "Same-Day Service" and the
    // higher rate applies. We enforce this server-side so the client
    // can never pick the cheaper tier by mistake.
    const MS_IN_24H = 24 * 60 * 60 * 1000;
    const advanceMs = bookingDate.getTime() - Date.now();
    const isSameDay = advanceMs < MS_IN_24H;

    const fareBreakdown = getFareBreakdown({
      userType,
      isSameDay,
      passengers,
      childWithAdult: !!childWithAdult,
      companions,
    });
    const officialFare = fareBreakdown.total;

    const setting = await SystemSetting.findOne({ key: "autoAccept" });
    const autoAccept = setting ? setting.value : false;
    const initialStatus = autoAccept ? "Confirmed" : "Pending";

    const randomChars = Math.random()
      .toString(36)
      .substring(2, 5)
      .toUpperCase();
    const ticketId = `ASH-${randomChars}`;

    const newRide = new Ride({
      passengerName,
      phoneNumber,
      pickup,
      pickupDetails,
      pickupCoordinates,
      dropoff,
      dropoffCoordinates,
      userType: normalizeUserType(userType, { childWithAdult: !!childWithAdult }),
      isSameDay,
      passengers,
      isOutOfTown,
      mileage,
      fare: officialFare,
      fareType: isSameDay ? "SameDay" : "Scheduled",
      scheduledTime: bookingDate,
      riderId: req.body.riderId,
      status: initialStatus,
      ticketId: ticketId,
      paymentMethod:
        paymentMethod && ["Cash", "Digital Pass", "Account", "Stripe"].includes(paymentMethod)
          ? paymentMethod
          : "Cash",
      paymentStatus: paymentMethod === "Stripe" ? "Pending" : "Pending",
      logs: [
        {
          user: "System",
          action: "Ride Requested",
          details: `Via Mobile App. Initial Status: ${initialStatus}`,
        },
      ],
      notifications: [
        {
          audience: "Dispatcher",
          message: `New ride request ${ticketId} created for ${passengerName}.`,
        },
      ],
    });

    await newRide.save();

    res.status(201).json(newRide);
    SocketService.emitRideUpdate(newRide);
  } catch (err) {
    console.error("Booking Error:", err);
    res.status(500).json({ message: err.message || "Server Error during booking." });
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
router.patch("/:id/vehicle", protect, async (req, res) => {
  try {
    const { assignedVehicle } = req.body;
    const prev = await Ride.findById(req.params.id).select("assignedVehicle riderId");
    if (!prev) return res.status(404).json({ message: "Ride not found" });

    const updatedRide = await Ride.findByIdAndUpdate(
      req.params.id,
      { assignedVehicle },
      { new: true },
    );
    if (!updatedRide) return res.status(404).json({ message: "Ride not found" });

    // Enrich the payload with driver details so the rider's mobile
    // app immediately knows "your driver is John in Van #3".
    let driverInfo = null;
    if (assignedVehicle && assignedVehicle !== "Unassigned") {
      const vehicle = await Vehicle.findOne({ name: assignedVehicle });
      if (vehicle?.assignedDriver) {
        const drv = await User.findOne({ username: vehicle.assignedDriver })
          .select("username fullName phoneNumber profilePhoto currentLocation status");
        driverInfo = {
          username: drv?.username || vehicle.assignedDriver,
          fullName: drv?.fullName || drv?.username || vehicle.assignedDriver,
          phoneNumber: drv?.phoneNumber || "",
          profilePhoto: drv?.profilePhoto || "",
          currentLocation: drv?.currentLocation || null,
          status: drv?.status || "Idle",
          vehicleName: vehicle.name,
          vehicleType: vehicle.type,
          vehiclePlate: vehicle.licensePlate || "",
        };
      }
    }

    await AuditLog.create({
      action: "RIDE_VEHICLE_ASSIGNED",
      performedBy: req.user?.username || "Dispatcher",
      targetId: updatedRide._id,
      targetModel: "Ride",
      changes: {
        from: prev.assignedVehicle,
        to: assignedVehicle,
        driver: driverInfo?.username || null,
      },
    });

    // Real-time broadcast so rider gets an instant notification and
    // dispatch + driver clients refresh their manifests.
    const enriched = { ...updatedRide.toObject(), driverInfo };
    SocketService.emitRideUpdate(updatedRide);
    if (updatedRide.riderId) {
      SocketService.io
        ?.to(`room_client_${updatedRide.riderId}`)
        .emit("driver_assigned", enriched);
    }
    if (driverInfo?.username) {
      SocketService.io
        ?.to(`room_driver_${driverInfo.username}`)
        .emit("manifest_updated", updatedRide);
    }

    res.json(enriched);
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
 * @route   POST /api/rides/:id/rider-cancel
 * @desc    Rider-initiated cancel (only if not En-Route / Completed)
 */
router.post("/:id/rider-cancel", protect, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (
      ride.riderId &&
      String(ride.riderId) !== String(req.user.id)
    ) {
      return res.status(403).json({ message: "Not your ride" });
    }
    if (["Completed", "Cancelled", "Rejected"].includes(ride.status)) {
      return res.status(400).json({ message: `Cannot cancel a ride in status ${ride.status}` });
    }
    if (ride.status === "En-Route") {
      return res
        .status(400)
        .json({ message: "Ride is already in progress. Contact dispatch to cancel." });
    }

    ride.status = "Cancelled";
    ride.logs.push({
      user: "Rider",
      action: "Cancelled Ride",
      details: req.body?.reason ? `Reason: ${req.body.reason}` : "Rider self-cancelled via mobile app.",
    });
    ride.notifications.push({
      audience: "Dispatcher",
      message: `Rider cancelled ${ride.ticketId}.`,
    });
    await ride.save();

    await AuditLog.create({
      action: "RIDE_RIDER_CANCEL",
      performedBy: req.user.id,
      targetId: ride._id,
      targetModel: "Ride",
      changes: { from: ride.status, to: "Cancelled" },
      metadata: req.body?.reason || "Rider self-cancel",
    }).catch(() => {});

    SocketService.emitRideUpdate(ride);
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
 * @route   GET /api/rides/payments/expo-return
 * @desc    Stripe redirects here (HTTPS/HTTP). Page immediately jumps to the Expo deep link so
 *          in-app browsers return to the app (raw exp:// 302 from Stripe is often blocked).
 */
router.get("/payments/expo-return", (req, res) => {
  try {
    const expoRaw = req.query.expo;
    const expoParam =
      typeof expoRaw === "string"
        ? expoRaw
        : Array.isArray(expoRaw)
          ? expoRaw[0]
          : "";
    const { ticketId, session_id, status } = req.query;
    if (!expoParam || typeof expoParam !== "string") {
      return res.status(400).send("Missing expo redirect.");
    }
    let expoBase;
    try {
      expoBase = decodeURIComponent(expoParam);
    } catch {
      return res.status(400).send("Invalid expo redirect.");
    }
    // Expo Linking.createURL uses one slash (exp:/host/...) not always exp:// — accept both.
    if (!/^(exp|exps|mobile):\/{1,2}/i.test(expoBase)) {
      return res.status(400).send("Invalid expo scheme.");
    }

    const tid = String(ticketId || "");
    const tidq = encodeURIComponent(tid);
    const join = expoBase.includes("?") ? "&" : "?";

    let target;
    if (String(status || "") === "cancel") {
      target = `${expoBase}${join}status=cancel&ticketId=${tidq}`;
    } else {
      const sid = String(session_id || "");
      const sidq = encodeURIComponent(sid);
      target = `${expoBase}${join}status=success&ticketId=${tidq}&session_id=${sidq}`;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Return to app</title></head><body style="font-family:system-ui;text-align:center;padding:24px">
<p style="color:#334155;font-weight:600">Opening Ashland Transit…</p>
<p style="color:#64748b;font-size:15px;margin:16px 0">If the app does not open, tap below.</p>
<p><a id="open" href=${JSON.stringify(
      target,
    )} style="display:inline-block;padding:14px 22px;background:#0f172a;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Open app</a></p>
<script>(function(){
var t=${JSON.stringify(target)};
try{location.replace(t);}catch(e){}
setTimeout(function(){try{location.href=t;}catch(e2){}},250);
})();</script>
</body></html>`);
  } catch (err) {
    res.status(500).send("Return URL error.");
  }
});

/**
 * @route   GET /api/rides/payments/success
 * @desc    Stripe redirects here after successful payment. Serves a self-closing HTML page.
 */
router.get("/payments/success", async (req, res) => {
  const { session_id, ticketId } = req.query;

  if (session_id) {
    try {
      const ride = await Ride.findOne({
        $or: [
          { stripeCheckoutSessionId: session_id },
          ...(ticketId ? [{ ticketId }] : []),
        ],
      });
      if (ride) {
        if (!stripe && canUseMockPayments) {
          await markRidePaid(ride, "Mock Redirect Verification");
        } else if (stripe) {
          const stripeSession = await stripe.checkout.sessions.retrieve(session_id);
          if (stripeSession.payment_status === "paid") {
            ride.stripePaymentIntentId = String(stripeSession.payment_intent || "");
            await markRidePaid(ride, "Stripe Redirect Verification");
          }
        }
      }
    } catch (err) {
      console.error("Payment success verification error:", err.message);
    }
  }

  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment Successful</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0fdf4}
.card{background:#fff;border-radius:24px;padding:48px 32px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.1);max-width:380px;width:90%}
.icon{font-size:64px;margin-bottom:16px}.title{font-size:24px;font-weight:900;color:#059669;margin-bottom:8px}.sub{font-size:14px;color:#64748b;font-weight:600;line-height:1.5}
.hint{margin-top:20px;font-size:12px;color:#94a3b8;font-weight:600}</style></head>
<body><div class="card"><div class="icon">&#10003;</div><div class="title">Payment Successful!</div>
<div class="sub">Your ride has been paid. You can close this window and return to the app.</div>
<div class="hint">This window will close automatically...</div></div>
<script>setTimeout(function(){try{window.close()}catch(e){}},2500);</script></body></html>`);
});

/**
 * @route   GET /api/rides/payments/cancel
 * @desc    Stripe redirects here when user cancels payment.
 */
router.get("/payments/cancel", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment Cancelled</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fef2f2}
.card{background:#fff;border-radius:24px;padding:48px 32px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.1);max-width:380px;width:90%}
.icon{font-size:64px;margin-bottom:16px}.title{font-size:24px;font-weight:900;color:#dc2626;margin-bottom:8px}.sub{font-size:14px;color:#64748b;font-weight:600;line-height:1.5}
.hint{margin-top:20px;font-size:12px;color:#94a3b8;font-weight:600}</style></head>
<body><div class="card"><div class="icon">&#10007;</div><div class="title">Payment Cancelled</div>
<div class="sub">No charge was made. You can close this window and try again from the app.</div>
<div class="hint">This window will close automatically...</div></div>
<script>setTimeout(function(){try{window.close()}catch(e){}},2500);</script></body></html>`);
});

/**
 * @route   POST /api/rides/:id/payments/checkout-session
 * @desc    Create Stripe checkout session or mock payment
 */
router.post("/:id/payments/checkout-session", async (req, res) => {
  try {
    const { successUrl, cancelUrl, source } = req.body || {};
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.paymentStatus === "Paid") {
      return res.json({
        alreadyPaid: true,
        ride,
        message: "Ride is already paid.",
      });
    }

    if (!stripe && canUseMockPayments) {
      ride.stripeCheckoutSessionId = `mock_session_${ride._id}`;
      await ride.save();
      const paidRide = await markRidePaid(ride, "Mock Checkout");
      return res.json({
        mockPaid: true,
        ride: paidRide,
        message: "Mock payment completed. Add Stripe keys to switch to live payments.",
      });
    }

    if (!stripe) {
      return res.status(500).json({
        message:
          "Stripe is not configured. Add STRIPE_SECRET_KEY or enable mock payments.",
      });
    }

    const serverOrigin = `${req.protocol}://${req.get("host")}`;
    const encodedTicket = encodeURIComponent(ride.ticketId);

    const defaultSuccessUrl = source === "web"
      ? `http://localhost:3000/track?ticketId=${encodedTicket}&checkoutSessionId={CHECKOUT_SESSION_ID}`
      : `${serverOrigin}/api/rides/payments/success?session_id={CHECKOUT_SESSION_ID}&ticketId=${encodedTicket}`;

    const defaultCancelUrl = source === "web"
      ? `http://localhost:3000/track?ticketId=${encodedTicket}&paymentCancelled=true`
      : `${serverOrigin}/api/rides/payments/cancel?ticketId=${encodedTicket}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl || defaultSuccessUrl,
      cancel_url: cancelUrl || defaultCancelUrl,
      metadata: {
        rideId: String(ride._id),
        ticketId: ride.ticketId || "",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: `Ashland Transit Ride ${ride.ticketId || ""}`.trim(),
              description: `${ride.pickup} -> ${ride.dropoff}`,
            },
            unit_amount: Math.round(Number(ride.fare || 0) * 100),
          },
        },
      ],
    });

    ride.paymentMethod = "Stripe";
    ride.paymentStatus = "Pending";
    ride.stripeCheckoutSessionId = session.id;
    ride.logs.push({
      user: "System",
      action: "Stripe Checkout Started",
      details: `Checkout Session ${session.id}`,
    });
    await ride.save();

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   GET /api/rides/payments/verify-session
 * @desc    Verify Stripe checkout success and persist payment
 */
router.get("/payments/verify-session", async (req, res) => {
  try {
    const { sessionId, ticketId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    const ride = await Ride.findOne({
      $or: [{ stripeCheckoutSessionId: sessionId }, ...(ticketId ? [{ ticketId }] : [])],
    });
    if (!ride) return res.status(404).json({ message: "Ride not found for session" });

    if (!stripe && canUseMockPayments) {
      const paidRide = await markRidePaid(ride, "Mock Session Verification");
      return res.json({ verified: true, ride: paidRide, mock: true });
    }

    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured on server." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.json({
        verified: false,
        paymentStatus: session.payment_status,
        ride,
      });
    }

    ride.stripePaymentIntentId = String(session.payment_intent || "");
    const paidRide = await markRidePaid(ride, "Stripe Session Verification");
    res.json({ verified: true, ride: paidRide });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   GET /api/rides/track/:ticketId/receipt
 * @desc    Download plain-text receipt for paid rides
 */
router.get("/track/:ticketId/receipt", async (req, res) => {
  try {
    const ride = await Ride.findOne({ ticketId: req.params.ticketId });
    if (!ride) return res.status(404).json({ message: "Ticket not found" });
    if (ride.paymentStatus !== "Paid") {
      return res.status(400).json({ message: "Receipt available only after payment success." });
    }

    const receiptText = [
      "Ashland Public Transit Receipt",
      "------------------------------------",
      `Receipt #: ${ride.paymentReceiptNumber || "N/A"}`,
      `Ticket: ${ride.ticketId}`,
      `Passenger: ${ride.passengerName}`,
      `Pickup: ${ride.pickup}`,
      `Dropoff: ${ride.dropoff}`,
      `Amount Paid: $${Number(ride.fare || 0).toFixed(2)}`,
      `Payment Method: ${ride.paymentMethod || "Stripe"}`,
      `Paid At: ${ride.paidAt ? new Date(ride.paidAt).toLocaleString() : "N/A"}`,
      "Status: Payment Successful",
    ].join("\n");

    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${ride.ticketId || "receipt"}.txt"`,
    );
    return res.send(receiptText);
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
      "ticketId status passengerName pickup pickupDetails dropoff scheduledTime fare assignedVehicle userType passengers paymentStatus paymentMethod paymentReceiptNumber paymentReceiptUrl paidAt notifications",
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
 * @route   PATCH /api/rides/fleet/drivers/:id
 * @desc    Dispatcher edits driver profile and moderation tags
 * @access  Protected (Dispatcher/Admin)
 */
router.patch(
  "/fleet/drivers/:id",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const { fullName, phoneNumber, licenseNumber, tags, isSuspended, status } =
        req.body;

      const updates = {};
      if (fullName !== undefined) updates.fullName = fullName;
      if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
      if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
      if (Array.isArray(tags)) updates.tags = tags;
      if (isSuspended !== undefined) updates.isSuspended = !!isSuspended;
      if (status !== undefined) updates.status = status;

      const driver = await User.findOneAndUpdate(
        { _id: req.params.id, role: { $regex: /^driver$/i } },
        { $set: updates },
        { new: true },
      ).select("-password");

      if (!driver) return res.status(404).json({ message: "Driver not found" });

      await AuditLog.create({
        action: "DRIVER_PROFILE_UPDATED",
        performedBy: req.currentUser.username || "Dispatcher",
        targetId: driver._id,
        targetModel: "User",
        changes: updates,
        metadata: "Dispatcher updated driver controls/profile",
      });

      SocketService.emitDispatcherAlert({
        type: "DRIVER_UPDATED",
        severity: "info",
        driverId: driver._id,
        message: `Driver profile updated for ${driver.username}.`,
        timestamp: Date.now(),
      });

      res.json(driver);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

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

/**
 * @route   GET /api/rides/dispatcher/operations-snapshot
 * @desc    Unified operations visibility for dispatcher control center
 * @access  Protected (Dispatcher/Admin)
 */
router.get(
  "/dispatcher/operations-snapshot",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const [rides, drivers, riders] = await Promise.all([
        Ride.find().sort({ scheduledTime: -1 }).limit(300),
        User.find({ role: { $regex: /^driver$/i } }).select("-password"),
        User.find({ role: { $regex: /^rider$/i } }).select("-password"),
      ]);

      res.json({
        rides,
        drivers,
        riders,
        fetchedAt: new Date(),
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

/**
 * @route   PATCH /api/rides/dispatcher/users/:id/control
 * @desc    Dispatcher moderation controls for rider/driver accounts
 * @access  Protected (Dispatcher/Admin)
 */
router.patch(
  "/dispatcher/users/:id/control",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const { isSuspended, tags, status } = req.body;
      const updates = {};
      if (isSuspended !== undefined) updates.isSuspended = !!isSuspended;
      if (Array.isArray(tags)) updates.tags = tags;
      if (status !== undefined) updates.status = status;

      const targetUser = await User.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true },
      ).select("-password");

      if (!targetUser) return res.status(404).json({ message: "User not found" });

      await AuditLog.create({
        action: "DISPATCHER_USER_CONTROL",
        performedBy: req.currentUser.username || "Dispatcher",
        targetId: targetUser._id,
        targetModel: "User",
        changes: updates,
        metadata: `Role: ${targetUser.role}`,
      });

      SocketService.emitDispatcherAlert({
        type: "USER_CONTROL_APPLIED",
        severity: "warning",
        userId: targetUser._id,
        message: `Dispatcher updated controls for ${targetUser.username}.`,
        timestamp: Date.now(),
      });

      res.json(targetUser);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// ============================================================
// DISPATCHER / ADMIN — EXTENDED OPERATIONS (Phase 4)
// ============================================================

/**
 * @route   GET /api/rides/dispatcher/kpi
 * @desc    Real-time KPI header: today's rides, revenue, on-time %,
 *          active drivers, no-show count, pending count.
 */
router.get(
  "/dispatcher/kpi",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [todayRides, activeDrivers, pendingCount] = await Promise.all([
        Ride.find({ scheduledTime: { $gte: start, $lt: end } }).select(
          "status fare finalizedFare scheduledTime paymentStatus logs passengers",
        ),
        User.countDocuments({
          role: { $regex: /^driver$/i },
          status: "Active",
          isSuspended: { $ne: true },
        }),
        Ride.countDocuments({ status: "Pending" }),
      ]);

      const total = todayRides.length;
      const completed = todayRides.filter((r) => r.status === "Completed").length;
      const cancelled = todayRides.filter((r) => r.status === "Cancelled").length;
      const noShow = todayRides.filter((r) =>
        (r.logs || []).some((l) => /no[- ]?show/i.test(l.action || l.details || "")),
      ).length;
      const revenue = todayRides
        .filter((r) => r.paymentStatus === "Paid" || r.status === "Completed")
        .reduce((s, r) => s + (r.finalizedFare || r.fare || 0), 0);
      const invoiced = todayRides
        .filter((r) => r.paymentStatus === "Invoiced")
        .reduce((s, r) => s + (r.finalizedFare || r.fare || 0), 0);
      const totalPax = todayRides.reduce(
        (s, r) => s + (r.passengers || 1),
        0,
      );

      // On-time %: En-Route started within +/- 10 minutes of scheduled.
      let onTime = 0;
      let onTimeDen = 0;
      todayRides.forEach((r) => {
        const log = (r.logs || []).find((l) => /en[- ]?route/i.test(l.action || ""));
        if (log?.timestamp && r.scheduledTime) {
          onTimeDen += 1;
          const deltaMin = Math.abs(
            (new Date(log.timestamp) - new Date(r.scheduledTime)) / 60000,
          );
          if (deltaMin <= 10) onTime += 1;
        }
      });

      res.json({
        today: start.toISOString(),
        totalRides: total,
        completedRides: completed,
        cancelledRides: cancelled,
        pendingRides: pendingCount,
        noShowRides: noShow,
        revenue: Math.round(revenue * 100) / 100,
        invoiced: Math.round(invoiced * 100) / 100,
        passengers: totalPax,
        activeDrivers,
        onTimePercent: onTimeDen ? Math.round((onTime / onTimeDen) * 100) : null,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

/**
 * @route   GET /api/rides/dispatcher/rider/:id
 * @desc    RIDER 360° — everything the dispatcher needs about one user.
 */
router.get(
  "/dispatcher/rider/:id",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const rider = await User.findById(req.params.id).select("-password");
      if (!rider) return res.status(404).json({ message: "Rider not found" });

      const rides = await Ride.find({
        $or: [{ riderId: rider._id }, { phoneNumber: rider.phoneNumber }],
      })
        .sort({ scheduledTime: -1 })
        .limit(500);

      const stats = {
        total: rides.length,
        completed: rides.filter((r) => r.status === "Completed").length,
        cancelled: rides.filter((r) => r.status === "Cancelled").length,
        noShow: rides.filter((r) =>
          (r.logs || []).some((l) =>
            /no[- ]?show/i.test(l.action || l.details || ""),
          ),
        ).length,
        totalSpent: rides
          .filter((r) => r.paymentStatus === "Paid")
          .reduce((s, r) => s + (r.finalizedFare || r.fare || 0), 0),
        outstanding: rides
          .filter((r) => r.paymentStatus === "Invoiced")
          .reduce((s, r) => s + (r.finalizedFare || r.fare || 0), 0),
      };

      const recentAudit = await AuditLog.find({
        targetId: rider._id,
        targetModel: "User",
      })
        .sort({ createdAt: -1 })
        .limit(25);

      res.json({ rider, stats, rides, audit: recentAudit });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

/**
 * @route   GET /api/rides/dispatcher/driver/:id
 * @desc    DRIVER 360° — everything the dispatcher needs about one driver.
 */
router.get(
  "/dispatcher/driver/:id",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const driver = await User.findById(req.params.id).select("-password");
      if (!driver || !/driver/i.test(driver.role || "")) {
        return res.status(404).json({ message: "Driver not found" });
      }

      const vehicle = await Vehicle.findOne({ assignedDriver: driver.username });
      const vehicleName = vehicle ? vehicle.name : null;

      const start = new Date();
      start.setDate(start.getDate() - 30);

      const rides = vehicleName
        ? await Ride.find({
          assignedVehicle: vehicleName,
          scheduledTime: { $gte: start },
        })
          .sort({ scheduledTime: -1 })
          .limit(300)
        : [];

      const completed = rides.filter((r) => r.status === "Completed");
      const revenue = completed.reduce(
        (s, r) => s + (r.finalizedFare || r.fare || 0),
        0,
      );
      const totalPax = completed.reduce((s, r) => s + (r.passengers || 1), 0);

      const audit = await AuditLog.find({
        targetId: driver._id,
        targetModel: "User",
      })
        .sort({ createdAt: -1 })
        .limit(25);

      res.json({
        driver,
        vehicle,
        rides,
        stats: {
          rides30d: rides.length,
          completed30d: completed.length,
          revenue30d: Math.round(revenue * 100) / 100,
          passengers30d: totalPax,
          onlineNow: driver.status === "Active",
          lastLocation: driver.currentLocation,
          lastLocationUpdate: driver.lastLocationUpdate,
        },
        audit,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

/**
 * @route   POST /api/rides/:id/dispatcher-notes
 * @desc    Append a dispatcher note to a ride (audit trail).
 */
router.post(
  "/:id/dispatcher-notes",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const { note } = req.body;
      if (!note || !String(note).trim()) {
        return res.status(400).json({ message: "Note cannot be empty" });
      }
      const ride = await Ride.findByIdAndUpdate(
        req.params.id,
        {
          $set: { dispatcherNotes: note },
          $push: {
            logs: {
              user: req.currentUser.username || "Dispatcher",
              action: "Dispatcher Note",
              details: note,
            },
          },
        },
        { new: true },
      );
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      SocketService.emitRideUpdate(ride);
      res.json(ride);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

/**
 * @route   POST /api/rides/:id/no-show
 * @desc    Manually mark a ride as no-show (applies APT fee + Cancelled).
 */
router.post(
  "/:id/no-show",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const { getNoShowFee } = require("../utils/fareCalculator");
      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      if (["Completed", "Cancelled", "Rejected"].includes(ride.status)) {
        return res
          .status(400)
          .json({ message: `Ride already ${ride.status}. No-show not applicable.` });
      }
      const fee = getNoShowFee(ride.userType);
      ride.status = "Cancelled";
      ride.fare = fee;
      ride.finalizedFare = fee;
      ride.paymentStatus = fee > 0 ? "Invoiced" : "Pending";
      ride.logs = ride.logs || [];
      ride.logs.push({
        user: req.currentUser.username || "Dispatcher",
        action: "NO_SHOW_MARKED",
        details: `No-show fee: $${fee.toFixed(2)}`,
      });
      await ride.save();

      await AuditLog.create({
        action: "NO_SHOW_MARKED",
        performedBy: req.currentUser.username || "Dispatcher",
        targetId: ride._id,
        targetModel: "Ride",
        changes: { fare: fee, status: "Cancelled" },
      });
      SocketService.emitRideUpdate(ride);
      res.json(ride);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

/**
 * @route   GET /api/rides/dispatcher/audit
 * @desc    Paginated audit log (dispatcher-only, with filters).
 */
router.get(
  "/dispatcher/audit",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const { action, user, limit = 100, skip = 0 } = req.query;
      const q = {};
      if (action) q.action = action;
      if (user) q.performedBy = user;
      const logs = await AuditLog.find(q)
        .sort({ createdAt: -1 })
        .skip(Number(skip) || 0)
        .limit(Math.min(500, Number(limit) || 100));
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// ─── VEHICLE CRUD (proper dispatcher fleet management) ───────────
router.post(
  "/vehicles",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const vehicle = await Vehicle.create(req.body || {});
      await AuditLog.create({
        action: "VEHICLE_CREATED",
        performedBy: req.currentUser.username || "Dispatcher",
        targetId: vehicle._id,
        targetModel: "Vehicle",
        changes: req.body,
      });
      SocketService.emitDispatcherAlert({
        type: "VEHICLE_CREATED",
        severity: "info",
        message: `Vehicle ${vehicle.name} added to fleet.`,
        timestamp: Date.now(),
      });
      res.status(201).json(vehicle);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.delete(
  "/vehicles/:id",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const veh = await Vehicle.findByIdAndDelete(req.params.id);
      if (!veh) return res.status(404).json({ message: "Vehicle not found" });
      await AuditLog.create({
        action: "VEHICLE_DELETED",
        performedBy: req.currentUser.username || "Dispatcher",
        targetId: veh._id,
        targetModel: "Vehicle",
      });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.post(
  "/vehicles/:id/service-log",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const { type, notes, cost, mileage, performedBy } = req.body || {};
      const entry = {
        type: type || "Service",
        notes: notes || "",
        cost: Number(cost) || 0,
        mileage: Number(mileage) || 0,
        performedBy: performedBy || req.currentUser.username || "Dispatcher",
        date: new Date(),
      };
      const veh = await Vehicle.findByIdAndUpdate(
        req.params.id,
        {
          $push: { maintenanceHistory: entry },
          $set: { lastServiceDate: new Date() },
        },
        { new: true },
      );
      if (!veh) return res.status(404).json({ message: "Vehicle not found" });
      await AuditLog.create({
        action: "VEHICLE_SERVICE_LOG",
        performedBy: req.currentUser.username || "Dispatcher",
        targetId: veh._id,
        targetModel: "Vehicle",
        changes: entry,
      });
      res.status(201).json(veh);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

/**
 * @route   POST /api/rides/dispatcher/broadcast
 * @desc    Send a message to all drivers or all riders (socket + log).
 */
router.post(
  "/dispatcher/broadcast",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const { audience = "drivers", message, severity = "info" } = req.body || {};
      if (!message) return res.status(400).json({ message: "Message required" });
      const payload = {
        from: req.currentUser.username || "Dispatch",
        message,
        severity,
        audience,
        timestamp: Date.now(),
      };
      if (audience === "drivers" || audience === "all") {
        SocketService.io?.emit("broadcast_drivers", payload);
      }
      if (audience === "riders" || audience === "all") {
        SocketService.io?.emit("broadcast_riders", payload);
      }
      SocketService.emitDispatcherAlert({
        type: "BROADCAST_SENT",
        severity,
        message: `Broadcast to ${audience}: ${message}`,
        timestamp: Date.now(),
      });
      await AuditLog.create({
        action: "DISPATCHER_BROADCAST",
        performedBy: req.currentUser.username || "Dispatcher",
        targetModel: "Broadcast",
        changes: payload,
      });
      res.json({ ok: true, sent: payload });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

/**
 * @route   POST /api/rides/dispatcher/message-driver
 * @desc    Targeted dispatcher → driver message (persisted + socket).
 */
router.post(
  "/dispatcher/message-driver",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const { driverUsername, message } = req.body || {};
      if (!driverUsername || !message) {
        return res
          .status(400)
          .json({ message: "driverUsername and message are required" });
      }
      SocketService.io
        ?.to(`room_driver_${driverUsername}`)
        .emit("dispatcher_message", {
          from: req.currentUser.username || "Dispatch",
          message,
          timestamp: Date.now(),
        });
      await AuditLog.create({
        action: "DISPATCHER_DM_DRIVER",
        performedBy: req.currentUser.username || "Dispatcher",
        targetModel: "User",
        changes: { driverUsername, message },
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// ─── LOCK DOWN previously-unauthenticated dispatcher endpoints ──
// NOTE: we keep the old unauthenticated read handlers above for
// backwards compatibility with mobile clients already in the field.
// Anything mutating is protected below by shadow routes that take
// precedence in the client.  If you want to fully lock the legacy
// endpoints, replace them inline above with `protect`.
router.get(
  "/dispatcher/manifest",
  protect,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      const { from, to } = req.query;
      const q = {};
      if (from || to) {
        q.scheduledTime = {};
        if (from) q.scheduledTime.$gte = new Date(from);
        if (to) q.scheduledTime.$lte = new Date(to);
      }
      const rides = await Ride.find(q).sort({ scheduledTime: 1 }).limit(1000);
      res.json(rides);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// ============================================================
// DRIVER-SCOPED ENDPOINTS (Phase 5)
// ============================================================

const requireDriver = async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id).select("role username");
    if (!u) return res.status(401).json({ message: "User not found" });
    if (!/driver/i.test(u.role)) {
      return res.status(403).json({ message: "Driver access only" });
    }
    req.driver = u;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route   GET /api/rides/driver/my-manifest
 * @desc    Rides assigned to the current driver's vehicle (today + upcoming).
 */
router.get("/driver/my-manifest", protect, requireDriver, async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ assignedDriver: req.driver.username });
    if (!vehicle) return res.json({ vehicle: null, rides: [] });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const rides = await Ride.find({
      assignedVehicle: vehicle.name,
      scheduledTime: { $gte: start, $lt: end },
      status: { $in: ["Pending", "Confirmed", "En-Route", "Completed"] },
    }).sort({ scheduledTime: 1 });

    res.json({ vehicle, rides });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   GET /api/rides/driver/active
 * @desc    Current in-progress ride for this driver (if any) with full rider info.
 */
router.get("/driver/active", protect, requireDriver, async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ assignedDriver: req.driver.username });
    if (!vehicle) return res.json(null);
    const ride = await Ride.findOne({
      assignedVehicle: vehicle.name,
      status: { $in: ["Confirmed", "En-Route"] },
    }).sort({ scheduledTime: 1 });
    if (!ride) return res.json(null);

    let rider = null;
    if (ride.riderId) {
      rider = await User.findById(ride.riderId).select(
        "username fullName phoneNumber profilePhoto avatar riderType emergencyContact accessibilityNotes mobilityNeeds",
      );
    }
    res.json({ ride, rider, vehicle });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   POST /api/rides/driver/shift
 * @desc    Driver goes on duty / off duty. Persists status + emits to dispatch.
 */
router.post("/driver/shift", protect, requireDriver, async (req, res) => {
  try {
    const { action } = req.body || {};
    const status =
      action === "start" ? "Active" : action === "break" ? "Break" : "Offline";
    const driver = await User.findByIdAndUpdate(
      req.driver._id,
      {
        status,
        ...(action === "start" && { lastShiftStart: new Date() }),
        ...(action === "end" && { lastShiftEnd: new Date() }),
      },
      { new: true },
    ).select("-password");

    SocketService.io?.to("room_dispatcher").emit("driver_status_updated", {
      driverUsername: driver.username,
      driverId: driver._id,
      status,
      timestamp: Date.now(),
    });
    SocketService.emitDispatcherAlert({
      type: "DRIVER_SHIFT",
      severity: "info",
      message: `${driver.username} ${action === "start" ? "started shift" : action === "break" ? "on break" : "ended shift"}.`,
      timestamp: Date.now(),
    });

    await AuditLog.create({
      action: "DRIVER_SHIFT",
      performedBy: driver.username,
      targetId: driver._id,
      targetModel: "User",
      changes: { status, action },
    });

    res.json({ status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   POST /api/rides/driver/arriving
 * @desc    Driver announces "I'm arriving" — rider gets a socket ping + audit.
 */
router.post("/driver/arriving", protect, requireDriver, async (req, res) => {
  try {
    const { rideId, etaMinutes } = req.body || {};
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    ride.logs = ride.logs || [];
    ride.logs.push({
      user: req.driver.username,
      action: "DRIVER_ARRIVING",
      details: `ETA ${etaMinutes || "?"} min`,
    });
    await ride.save();

    if (ride.riderId) {
      SocketService.io
        ?.to(`room_client_${ride.riderId}`)
        .emit("driver_arriving", {
          rideId: ride._id,
          driverUsername: req.driver.username,
          etaMinutes,
          timestamp: Date.now(),
        });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   POST /api/rides/driver/message-rider
 * @desc    Targeted message from driver to rider (safe chat channel).
 */
router.post(
  "/driver/message-rider",
  protect,
  requireDriver,
  async (req, res) => {
    try {
      const { riderId, rideId, message } = req.body || {};
      if (!message) return res.status(400).json({ message: "Message required" });
      const room = rideId ? `room_client_${rideId}` : `room_client_${riderId}`;
      SocketService.io?.to(room).emit("driver_message", {
        from: req.driver.username,
        message,
        timestamp: Date.now(),
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

/**
 * @route   POST /api/rides/driver/walkie
 * @desc    Push a "radio" text blast to the dispatcher with priority.
 *          MVP: text+severity (prelude to audio PTT). All audited.
 */
router.post("/driver/walkie", protect, requireDriver, async (req, res) => {
  try {
    const { message, severity = "info" } = req.body || {};
    if (!message) return res.status(400).json({ message: "Message required" });
    SocketService.io?.to("room_dispatcher").emit("walkie_driver", {
      from: req.driver.username,
      message,
      severity,
      timestamp: Date.now(),
    });
    await AuditLog.create({
      action: "DRIVER_WALKIE",
      performedBy: req.driver.username,
      targetModel: "Walkie",
      changes: { message, severity },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
