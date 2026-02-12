
// Mock Driver Service - Simulation Logic for POC

// Starting Lat/Lng around Ashland, OH (Center: 40.8688, -82.3179)
const STARTING_CONFIGS = [
    { id: 'v1', name: 'Unit 101', type: 'Van', lat: 40.8688, lng: -82.3179, heading: 0, speed: 0.0003 },
    { id: 'v2', name: 'Unit 104', type: 'Sedan', lat: 40.8750, lng: -82.3200, heading: 90, speed: 0.0004 },
    { id: 'v3', name: 'Unit 106', type: 'Van', lat: 40.8600, lng: -82.3100, heading: 180, speed: 0.0002 },
    { id: 'v4', name: 'Unit 108', type: 'Sedan', lat: 40.8700, lng: -82.3300, heading: 270, speed: 0.0005 },
];

export const generateMockDrivers = () => {
    return STARTING_CONFIGS.map(d => ({ ...d }));
};

export const moveDrivers = (drivers) => {
    return drivers.map(driver => {
        // Simulate random movement logic
        // Change heading slightly to create "natural" driving curves
        const headingChange = (Math.random() - 0.5) * 20; // +/- 10 degrees
        let newHeading = (driver.heading + headingChange) % 360;

        // Convert heading to radians
        const rad = newHeading * (Math.PI / 180);

        // Calculate new position
        // speed is roughly degrees per tick. 0.001 deg is approx 110 meters.
        const newLat = driver.lat + (Math.cos(rad) * driver.speed);
        const newLng = driver.lng + (Math.sin(rad) * driver.speed);

        // Boundary Check (roughly Ashland Area)
        // If out of bounds, turn around (flip heading)
        let finalHeading = newHeading;
        if (newLat > 40.92 || newLat < 40.82 || newLng > -82.25 || newLng < -82.40) {
            finalHeading = (finalHeading + 180) % 360;
        }

        return {
            ...driver,
            lat: newLat,
            lng: newLng,
            heading: finalHeading
        };
    });
};

// Haversine Formula for generic distance (in km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
};

// Estimate ETA in Minutes
// Assumes average city speed of 30mph (~48km/h)
export const calculateETA = (driverLat, driverLng, targetLat, targetLng) => {
    if (!driverLat || !targetLat) return "N/A";

    const distKm = calculateDistance(driverLat, driverLng, targetLat, targetLng);
    const speedKmh = 48; // 30 mph

    const timeHours = distKm / speedKmh;
    const timeMinutes = Math.round(timeHours * 60);

    // Add buffer for traffic/lights
    return Math.max(timeMinutes + 2, 1); // Minimum 1 min
};
