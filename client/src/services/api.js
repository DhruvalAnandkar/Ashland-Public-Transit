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


// EXPERT: Fleet Management
export const getVehicles = async () => {
    const response = await axios.get(`${API_URL}/vehicles`);
    return response.data;
};

export const updateVehicleStatus = async (id, status) => {
    const response = await axios.patch(`${API_URL}/vehicles/${id}`, { status });
    return response.data;
};

// STAFF: Edit Ride Details (Time/Fare)
export const updateRideDetails = async (id, details) => {
    try {
        const response = await axios.patch(`${API_URL}/${id}/details`, details);
        return response.data;
    } catch (error) {
        console.error("Error updating ride details:", error);
        throw error;
    }
};

// RIDER: Track specific ride
export const getRideByTicket = async (ticketId) => {
    try {
        // ENCODE ID: Handles '#' characters correctly (e.g. #ASH-123 -> %23ASH-123)
        const response = await axios.get(`${API_URL}/track/${encodeURIComponent(ticketId)}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching ticket:", error);
        throw error;
    }
};
