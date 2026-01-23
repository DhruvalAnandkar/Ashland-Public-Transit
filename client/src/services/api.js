import axios from 'axios';

// The URL where your Express server is running
const API_URL = 'http://localhost:5000/api/rides';

export const createRide = async (rideData) => {
    try {
        const response = await axios.post(API_URL, rideData);
        return response.data;
    } catch (error) {
        console.error("Error creating ride:", error);
        throw error;
    }
};

export const getRides = async () => {
    try {
        const response = await axios.get(API_URL);
        return response.data;
    } catch (error) {
        console.error("Error fetching rides:", error);
        throw error;
    }
};