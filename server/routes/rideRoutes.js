const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const calculateFare = require('../utils/fareCalculator');

/**
 * @route   GET /api/rides/check-capacity
 * @desc    Resource-Based Fleet Logic (Checks Vehicles AND Seats)
 */
router.get('/check-capacity', async (req, res) => {
    try {
        const { time, passengerCount } = req.query; 
        if (!time) return res.status(400).json({ message: "Time is required" });

        const selectedTime = new Date(time);
        // Window: 30 mins before and after requested time
        const windowStart = new Date(selectedTime.getTime() - 30 * 60000);
        const windowEnd = new Date(selectedTime.getTime() + 30 * 60000);

        // Find all confirmed rides in this time window
        const activeRides = await Ride.find({
            status: 'Confirmed',
            scheduledTime: { $gte: windowStart, $lte: windowEnd }
        });

        // ASSET DEFINITION
        const FLEET = {
            totalVehicles: 7, // 5 Large Vans + 2 Small Cars
            largeVans: 5,
            smallCars: 2,
            totalSeats: 29
        };

        const confirmedBookingsCount = activeRides.length;
        const currentOccupiedSeats = activeRides.reduce((acc, r) => acc + r.passengers, 0);
        const requestedSeats = parseInt(passengerCount) || 1;

        // --- EXPERT LOGIC ENGINE ---

        // 1. VEHICLE LIMIT: Are all 7 drivers/cars already busy?
        const allVehiclesBusy = confirmedBookingsCount >= FLEET.totalVehicles;

        // 2. SEAT LIMIT: Are the physical seats full?
        const seatsFull = (currentOccupiedSeats + requestedSeats) > FLEET.totalSeats;

        // 3. GROUP SIZE LIMIT: Can any single vehicle fit this group? (Max 5)
        const tooLargeForAnyVehicle = requestedSeats > 5;

        // FINAL DECISION
        const isFull = allVehiclesBusy || seatsFull || tooLargeForVehicle;
        
        // BUSY WARNING: Triggered when 5 out of 7 vehicles are used
        const isBusy = confirmedBookingsCount >= 5;

        res.json({ 
            isFull, 
            isBusy,
            fleetUsage: `${confirmedBookingsCount}/${FLEET.totalVehicles} Vehicles`,
            remainingSeats: FLEET.totalSeats - currentOccupiedSeats,
            message: isFull ? "Fleet Fully Dispatched" : isBusy ? "High Demand" : "Clear"
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   POST /api/rides
 */
router.post('/', async (req, res) => {
    try {
        const { 
            passengerName, phoneNumber, pickup, dropoff, 
            userType, isSameDay, passengers, isOutOfTown, 
            mileage, scheduledTime 
        } = req.body;

        if (!passengerName || !phoneNumber || !pickup || !dropoff || !scheduledTime) {
            return res.status(400).json({ message: "Missing required fields." });
        }

        const bookingDate = new Date(scheduledTime);
        if (bookingDate < new Date()) {
            return res.status(400).json({ message: "Cannot schedule rides in the past." });
        }

        const officialFare = calculateFare(userType, isSameDay, passengers, isOutOfTown, mileage);

        const newRide = new Ride({
            passengerName, phoneNumber, pickup, dropoff,
            userType, isSameDay, passengers, isOutOfTown,
            mileage, fare: officialFare,
            scheduledTime: bookingDate,
            status: 'Pending Review' // Forces Liz to manually approve
        });

        const savedRide = await newRide.save();
        res.status(201).json(savedRide);
    } catch (err) {
        res.status(500).json({ message: "Server Error during booking." });
    }
});

/**
 * @route   GET /api/rides
 */
router.get('/', async (req, res) => {
    try {
        const rides = await Ride.find().sort({ scheduledTime: 1 });
        res.json(rides);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   PATCH /api/rides/:id/status
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const { status, dispatcherNotes } = req.body;
        const updatedRide = await Ride.findByIdAndUpdate(req.params.id, { status, dispatcherNotes }, { new: true });
        if (!updatedRide) return res.status(404).json({ message: "Ride not found" });
        res.json(updatedRide);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

/**
 * @route   PATCH /api/rides/:id/vehicle
 */
router.patch('/:id/vehicle', async (req, res) => {
    try {
        const { assignedVehicle } = req.body;
        const updatedRide = await Ride.findByIdAndUpdate(
            req.params.id,
            { assignedVehicle },
            { new: true }
        );

        if (!updatedRide) return res.status(404).json({ message: "Ride not found" });
        res.json(updatedRide);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;