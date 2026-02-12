const Ride = require('../models/Ride');

exports.getMyRides = async (req, res) => {
    try {
        // Find rides where the rider matches the logged-in user
        // Note: Using 'riderId' as defined in our schema
        const rides = await Ride.find({ riderId: req.user.id }).sort({ scheduledTime: -1 });
        res.json(rides);
    } catch (err) {
        res.status(500).send('Server Error');
    }
};
