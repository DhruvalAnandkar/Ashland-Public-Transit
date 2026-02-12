import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// CRITICAL: URL Configuration
// For Android Emulator, use 'http://10.0.2.2:5000/api'
// For Physical Device, use your computer's LAN IP (e.g., 'http://192.168.1.XX:5000/api')
const API_URL = 'http://192.168.1.8:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Event Emitter for Unauthorized Redirects
let onUnauthorizedCallback = null;
export const setUnauthorizedCallback = (callback) => {
    onUnauthorizedCallback = callback;
};

// JWT Interceptor (Request)
api.interceptors.request.use(async (config) => {
    try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
            // Use x-auth-token as primary, but keep Authorization if needed by some older logic? 
            // The prompt asked to attach x-auth-token.
            config.headers['x-auth-token'] = token;
            config.headers.Authorization = `Bearer ${token}`; // Dual send for safety during migration
        }
    } catch (error) {
        console.error("Error retrieving token:", error);
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response Interceptor (Catch 401s)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            console.warn("401 Unauthorized detected. Logging out...");
            await SecureStore.deleteItemAsync('token');
            if (onUnauthorizedCallback) {
                onUnauthorizedCallback();
            }
        }
        return Promise.reject(error);
    }
);

// Authentication Services
export const login = async (username, password) => {
    try {
        const response = await api.post('/auth/login', { username, password });
        if (response.data.token) {
            await SecureStore.setItemAsync('token', response.data.token);
            await SecureStore.setItemAsync('user', JSON.stringify(response.data)); // Persist User
        }
        return response.data;
    } catch (error) {
        console.error("Login Error:", error.response?.data || error.message);
        throw error;
    }
};

export const signup = async (userData) => {
    try {
        const response = await api.post('/auth/signup', userData);
        if (response.data.token) {
            await SecureStore.setItemAsync('token', response.data.token);
            await SecureStore.setItemAsync('user', JSON.stringify(response.data)); // Persist User
        }
        return response.data;
    } catch (error) {
        console.error("Signup Error:", error.response?.data || error.message);
        throw error;
    }
};

export const logout = async () => {
    try {
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('user'); // Clear User
    } catch (error) {
        console.error("Logout Error:", error);
    }
};

export const checkSession = async () => {
    try {
        const token = await SecureStore.getItemAsync('token');
        const userString = await SecureStore.getItemAsync('user');
        if (token && userString) {
            return JSON.parse(userString);
        }
        return null;
    } catch (error) {
        console.error("Session Restore Error:", error);
        return null;
    }
};

export const createRide = async (rideData) => {
    try {
        const response = await api.post('/rides', rideData);
        return response.data;
    } catch (error) {
        console.error("Create Ride Error:", error.response?.data || error.message);
        throw error;
    }
};

export const getRideHistory = async () => {
    try {
        const response = await api.get('/rides/my-rides');
        return response.data;
    } catch (error) {
        console.error("Get History Error:", error.response?.data || error.message);
        throw error;
    }
};

export default api;
