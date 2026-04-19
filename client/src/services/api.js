import axios from 'axios';
import config from '../config';

const API_URL = `${config.API_URL}/api/rides`;
const AUTH_URL = `${config.API_URL}/api/auth`;

// JWT INTERCEPTOR: Automatically attaches token to every request
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// AUTH: Login to get JWT
export const login = async (username, password) => {
    try {
        const response = await axios.post(`${AUTH_URL}/login`, { username, password });
        return response.data;
    } catch (error) {
        console.error("Login failed:", error);
        throw error;
    }
};

// RIDER: Create a new request
export const createRide = async (rideData) => {
    const response = await axios.post(API_URL, rideData);
    return response.data;
};

// RIDER: Create Stripe checkout session for a ride
export const createRideCheckoutSession = async (rideId, payload = {}) => {
    const response = await axios.post(`${API_URL}/${rideId}/payments/checkout-session`, payload);
    return response.data;
};

// RIDER: Verify Stripe checkout success and persist payment status
export const verifyRideCheckoutSession = async (sessionId, ticketId) => {
    const response = await axios.get(`${API_URL}/payments/verify-session`, {
        params: { sessionId, ticketId },
    });
    return response.data;
};

// RIDER: Download receipt for a paid ride
export const downloadRideReceipt = async (ticketId) => {
    const response = await axios.get(`${API_URL}/track/${encodeURIComponent(ticketId)}/receipt`, {
        responseType: "blob",
    });
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

// NEW: Assign Driver to Vehicle
export const updateVehicleDriver = async (id, assignedDriver) => {
    try {
        const response = await axios.patch(`${API_URL}/vehicles/${id}`, { assignedDriver });
        return response.data;
    } catch (error) {
        console.error("Error updating driver assignment:", error);
        throw error;
    }
};

// STAFF: Get All Drivers for Assignment
export const getDrivers = async () => {
    try {
        const response = await axios.get(`${AUTH_URL}/drivers`);
        return response.data;
    } catch (error) {
        console.error("Error fetching drivers:", error);
        return [];
    }
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

// DRIVER: Push current GPS location (REST fallback for rider live tracking)
export const postDriverLocation = async (coordinates) => {
    try {
        const response = await axios.post(`${API_URL}/fleet/driver-location`, { coordinates });
        return response.data;
    } catch (error) {
        console.error("Error posting driver location:", error);
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
// ADMIN: Global Settings (Auto-Accept)
export const getAutoAccept = async () => {
    try {
        const response = await axios.get(`${API_URL}/settings/auto-accept`);
        return response.data;
    } catch (error) {
        console.error("Error fetching settings:", error);
        return { autoAccept: false }; // Safe default
    }
};

export const updateAutoAccept = async (autoAccept) => {
    try {
        const response = await axios.post(`${API_URL}/settings/auto-accept`, { autoAccept });
        return response.data;
    } catch (error) {
        console.error("Error updating settings:", error);
        throw error;
    }
};

// ADMIN: Get Audit Logs
export const getAuditLogs = async () => {
    try {
        const response = await axios.get(`${API_URL}/admin/audit-logs`);
        return response.data;
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        return [];
    }
};

// DISPATCHER: Full visibility snapshot across riders/drivers/rides
export const getOperationsSnapshot = async () => {
    const response = await axios.get(`${API_URL}/dispatcher/operations-snapshot`);
    return response.data;
};

// ─── DISPATCHER 4.0 — Rider/Driver 360, broadcasts, notes ───────
export const getDispatcherKpi = async () => {
    const { data } = await axios.get(`${API_URL}/dispatcher/kpi`);
    return data;
};

export const getRider360 = async (id) => {
    const { data } = await axios.get(`${API_URL}/dispatcher/rider/${id}`);
    return data;
};

export const getDriver360 = async (id) => {
    const { data } = await axios.get(`${API_URL}/dispatcher/driver/${id}`);
    return data;
};

export const addDispatcherNote = async (rideId, note) => {
    const { data } = await axios.post(`${API_URL}/${rideId}/dispatcher-notes`, { note });
    return data;
};

export const markNoShow = async (rideId) => {
    const { data } = await axios.post(`${API_URL}/${rideId}/no-show`);
    return data;
};

export const getDispatcherAudit = async (params = {}) => {
    const { data } = await axios.get(`${API_URL}/dispatcher/audit`, { params });
    return data;
};

// ─── Vehicle CRUD ─────────────────────────────────────────────
export const createVehicle = async (payload) => {
    const { data } = await axios.post(`${API_URL}/vehicles`, payload);
    return data;
};

export const deleteVehicle = async (id) => {
    const { data } = await axios.delete(`${API_URL}/vehicles/${id}`);
    return data;
};

export const addVehicleServiceLog = async (id, entry) => {
    const { data } = await axios.post(`${API_URL}/vehicles/${id}/service-log`, entry);
    return data;
};

// ─── User moderation (rider/driver suspend, tags) ───────────────
export const updateUserControl = async (userId, payload) => {
    const { data } = await axios.patch(
        `${API_URL}/dispatcher/users/${userId}/control`,
        payload,
    );
    return data;
};

export const updateDriverProfile = async (driverId, payload) => {
    const { data } = await axios.patch(
        `${API_URL}/fleet/drivers/${driverId}`,
        payload,
    );
    return data;
};

// ─── Broadcast + direct messages ────────────────────────────────
export const sendBroadcast = async ({ audience, message, severity }) => {
    const { data } = await axios.post(`${API_URL}/dispatcher/broadcast`, {
        audience,
        message,
        severity,
    });
    return data;
};

export const messageDriver = async (driverUsername, message) => {
    const { data } = await axios.post(`${API_URL}/dispatcher/message-driver`, {
        driverUsername,
        message,
    });
    return data;
};

// ─── Driver-scoped endpoints ─────────────────────────────────────
export const getDriverManifest = async () => {
    const { data } = await axios.get(`${API_URL}/driver/my-manifest`);
    return data;
};

export const getDriverActiveRide = async () => {
    const { data } = await axios.get(`${API_URL}/driver/active`);
    return data;
};

export const postDriverShift = async (action) => {
    const { data } = await axios.post(`${API_URL}/driver/shift`, { action });
    return data;
};

export const notifyDriverArriving = async (rideId, etaMinutes) => {
    const { data } = await axios.post(`${API_URL}/driver/arriving`, {
        rideId,
        etaMinutes,
    });
    return data;
};

export const driverMessageRider = async (payload) => {
    const { data } = await axios.post(`${API_URL}/driver/message-rider`, payload);
    return data;
};

export const driverWalkie = async (message, severity = "info") => {
    const { data } = await axios.post(`${API_URL}/driver/walkie`, {
        message,
        severity,
    });
    return data;
};

// ─── Auth / password helpers ─────────────────────────────────────
export const changePassword = async (currentPassword, newPassword) => {
    const { data } = await axios.post(`${AUTH_URL}/change-password`, {
        currentPassword,
        newPassword,
    });
    return data;
};

export const updateMyProfile = async (payload) => {
    const { data } = await axios.patch(`${AUTH_URL}/me`, payload);
    return data;
};

export const getMe = async () => {
    const { data } = await axios.get(`${AUTH_URL}/me`);
    return data;
};
