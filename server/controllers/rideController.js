const Ride = require("../models/Ride");
const SchedulingService = require("../services/SchedulingService");

exports.getMyRides = async (req, res) => {
  try {
    // Find rides where the rider matches the logged-in user
    // Note: Using 'riderId' as defined in our schema
    const rides = await Ride.find({ riderId: req.user.id }).sort({
      scheduledTime: -1,
    });
    res.json(rides);
  } catch (err) {
    res.status(500).send("Server Error");
  }
};

// NOT BOUND TO ANY ROUTE — cleanup pending
// WARNING: This function uses SchedulingService auto-dispatch logic and is intended
// for future route binding. Do NOT bind without first verifying it against the
// capacity-check and Auto-Accept logic already implemented inline in rideRoutes.js.
exports.createRide = async (req, res) => {
  try {
    const {
      passengers,
      mobilityNeeds,
      scheduledTime,
      pickup,
      dropoff,
      ...rest
    } = req.body;

    // Auto-Dispatch Logic
    const bestVehicle = await SchedulingService.findBestVehicle({
      passengers,
      mobilityNeeds,
    });

    // Add auto-dispatch outcome to log
    const initialLog = {
      user: "System",
      action: bestVehicle
        ? "Auto-Assigned Vehicle"
        : "Ride Created (Pending Assignment)",
      details: bestVehicle
        ? `System algorithm assigned ${bestVehicle.name} to this ride.`
        : "No eligible vehicle found with current availability/requirements.",
    };

    const newRide = new Ride({
      ...rest,
      passengers,
      scheduledTime,
      pickup,
      dropoff,
      riderId: req.user.id, // Authenticated user
      assignedVehicle: bestVehicle ? bestVehicle.name : "Unassigned",
      status: bestVehicle ? "Confirmed" : "Pending",
      logs: [initialLog],
    });

    const ride = await newRide.save();

    res.json(ride);
  } catch (err) {
    console.error("Error creating ride:", err);
    res.status(500).send("Server Error");
  }
};
