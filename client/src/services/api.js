import axios from 'axios';

const API_URL = 'http://localhost:5000/api/rides';

// RIDER: Create a new request
export const createRide = async (rideData) => {
    const response = await axios.post(API_URL, rideData);
    return response.data;
};

// STAFF: Get the full manifest
export const getRides = async () => {
    const response = await axios.get(API_URL);
    return response.data;
};

// STAFF: Update Approve/Reject status
export const updateRideStatus = async (id, status, dispatcherNotes = "") => {
    const response = await axios.patch(`${API_URL}/${id}/status`, { status, dispatcherNotes });
    return response.data;
};

// RIDER: Live check if vehicle has seats (Now includes passenger count for better math)
export const checkCapacity = async (time, passengerCount = 1) => {
    try {
        const response = await axios.get(`${API_URL}/check-capacity?time=${time}&passengerCount=${passengerCount}`);
        return response.data; // Returns { confirmedCount, isFull, isBusy }
    } catch (error) {
        console.error("Error checking capacity:", error);
        return { isFull: false, isBusy: false };
    }
};

// STAFF: Assign specific vehicle (Large Van vs Small Car)
export const updateRideVehicle = async (id, assignedVehicle) => {
    try {
        const response = await axios.patch(`${API_URL}/${id}/vehicle`, { assignedVehicle });
        return response.data;
    } catch (error) {
        console.error("Error updating vehicle assignment:", error);
        throw error;
    }
};