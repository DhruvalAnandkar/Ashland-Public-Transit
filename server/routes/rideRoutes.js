const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');

// @route   POST /api/rides
// @desc    Create a new ride request
router.post('/', async (req, res) => {
    try {
        console.log("Expert Log: Received data:", req.body); 
        const newRide = new Ride(req.body);
        const savedRide = await newRide.save();
        res.status(201).json(savedRide);
    } catch (err) {
        console.error("Expert Error: Save failed:", err.message);
        res.status(400).json({ message: err.message });
    }
});

// @route   GET /api/rides
// @desc    Get all rides (Useful for your upcoming Dashboard)
router.get('/', async (req, res) => {
    try {
        const rides = await Ride.find().sort({ createdAt: -1 });
        res.json(rides);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;