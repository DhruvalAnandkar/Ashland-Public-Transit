const Vehicle = require('../models/Vehicle');

/**
 * SchedulingService
 * The "Brain" of the Ashland Public Transit Platform.
 * Replaces manual dispatching with algorithmic matchmaking for optimal fleet utilization.
 */
class SchedulingService {

    /**
     * Finds the best available vehicle for a given ride request.
     * 
     * @param {Object} rideRequest - The incoming ride request details.
     * @param {Number} rideRequest.passengers - Number of passengers.
     * @param {Array<String>} rideRequest.mobilityNeeds - Array of required features (e.g., ['wheelchair_lift']).
     * @returns {Object|null} - The assigned Vehicle document, or null if no match is found.
     */
    static async findBestVehicle(rideRequest) {
        try {
            const { passengers, mobilityNeeds = [] } = rideRequest;

            // Step 1: Query the database for eligible vehicles
            // We use MongoDB query operators to strictly filter the fleet.
            const query = {
                status: 'Active', // Vehicle must not be 'In Shop'
                capacity: { $gte: passengers } // Must have enough seats
            };

            // If the client has specific mobility needs, the vehicle MUST have ALL of them
            if (mobilityNeeds.length > 0) {
                query.features = { $all: mobilityNeeds };
            }

            // Fetch all matching vehicles. 
            // In a full production scenario, we would also check calendar/time-blocks here.
            const eligibleVehicles = await Vehicle.find(query);

            if (eligibleVehicles.length === 0) {
                console.warn('SchedulingService: No eligible vehicles found for request.', rideRequest);
                return null;
            }

            // Step 2: Select the optimal vehicle
            // For now, we simply pick the first available one. 
            // Future evolution: sort by nearest location or lowest engine hours.
            const selectedVehicle = eligibleVehicles[0];

            console.info(`SchedulingService: Assigned vehicle ${selectedVehicle.name} to request.`);

            return selectedVehicle;
        } catch (error) {
            console.error('SchedulingService: Error finding best vehicle', error);
            throw error;
        }
    }

    /**
     * Calculates the Estimated Time of Arrival (ETA) between two points.
     * 
     * @param {Object} pickupCoordinates - GeoJSON Point { type: 'Point', coordinates: [lng, lat] }
     * @param {Object} dropoffCoordinates - GeoJSON Point { type: 'Point', coordinates: [lng, lat] }
     * @returns {Number} - The estimated transit time in minutes.
     */
    static calculateETA(pickupCoordinates, dropoffCoordinates) {
        // TODO: Integrate Mapbox or Google Maps Distance Matrix API here.
        // Currently returning a mock routing placeholder.
        const mockEtaMinutes = 15;

        console.debug('SchedulingService: Calculated ETA using mock routing stub:', mockEtaMinutes);

        return mockEtaMinutes;
    }
}

module.exports = SchedulingService;
