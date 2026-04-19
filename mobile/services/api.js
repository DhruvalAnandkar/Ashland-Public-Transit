import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// URL Resolution — honour Expo's hostUri for LAN dev so we don't hardcode an IP.
const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(":")[0] : "172.23.19.248";
const API_URL = `http://${localhost}:5000/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Unauthorized hook (used by app root to force logout) ─────
let onUnauthorizedCallback = null;
export const setUnauthorizedCallback = (callback) => {
  onUnauthorizedCallback = callback;
};

// ─── Request: attach JWT ──────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync("token");
      if (token) {
        config.headers["x-auth-token"] = token;
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error retrieving token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response: force logout on 401 ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await SecureStore.deleteItemAsync("token");
      if (onUnauthorizedCallback) onUnauthorizedCallback();
    }
    return Promise.reject(error);
  },
);

// ─── Session persistence helpers ──────────────────────────────
const persistSession = async (data) => {
  if (data?.token) {
    await SecureStore.setItemAsync("token", data.token);
  }
  await SecureStore.setItemAsync("user", JSON.stringify(data));
};

export const login = async (username, password) => {
  const { data } = await api.post("/auth/login", { username, password });
  if (data?.token) await persistSession(data);
  return data;
};

export const signup = async (userData) => {
  const { data } = await api.post("/auth/signup", userData);
  if (data?.token) await persistSession(data);
  return data;
};

export const logout = async () => {
  try {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

export const checkSession = async () => {
  try {
    const token = await SecureStore.getItemAsync("token");
    const userString = await SecureStore.getItemAsync("user");
    if (token && userString) return JSON.parse(userString);
    return null;
  } catch (error) {
    console.error("Session Restore Error:", error);
    return null;
  }
};

// ─── Profile ──────────────────────────────────────────────────
export const getMyProfile = async () => {
  const { data } = await api.get("/auth/me");
  const existing = await SecureStore.getItemAsync("user");
  const merged = { ...(existing ? JSON.parse(existing) : {}), ...data };
  await SecureStore.setItemAsync("user", JSON.stringify(merged));
  return data;
};

export const updateMyProfile = async (patch) => {
  const { data } = await api.patch("/auth/me", patch);
  const existing = await SecureStore.getItemAsync("user");
  const merged = { ...(existing ? JSON.parse(existing) : {}), ...data };
  await SecureStore.setItemAsync("user", JSON.stringify(merged));
  return data;
};

export const deleteMyAccount = async () => {
  const { data } = await api.delete("/auth/me", { data: { confirm: "DELETE" } });
  await logout();
  return data;
};

// ─── Password: change / forgot / reset ────────────────────────
export const changePassword = async (currentPassword, newPassword) => {
  const { data } = await api.post("/auth/change-password", {
    currentPassword,
    newPassword,
  });
  return data;
};

export const requestPasswordReset = async (identifier) => {
  const { data } = await api.post("/auth/password/forgot", { identifier });
  return data;
};

export const verifyResetCode = async (identifier, code) => {
  const { data } = await api.post("/auth/password/verify-code", {
    identifier,
    code,
  });
  return data;
};

export const resetPassword = async (identifier, code, newPassword) => {
  const { data } = await api.post("/auth/password/reset", {
    identifier,
    code,
    newPassword,
  });
  if (data?.token) await persistSession(data);
  return data;
};

// ─── Saved Places ─────────────────────────────────────────────
export const listSavedPlaces = async () => {
  const { data } = await api.get("/auth/places");
  return data;
};

export const addSavedPlace = async (place) => {
  const { data } = await api.post("/auth/places", place);
  return data;
};

export const updateSavedPlace = async (id, patch) => {
  const { data } = await api.patch(`/auth/places/${id}`, patch);
  return data;
};

export const deleteSavedPlace = async (id) => {
  const { data } = await api.delete(`/auth/places/${id}`);
  return data;
};

// ─── Payment Methods ──────────────────────────────────────────
export const listPaymentMethods = async () => {
  const { data } = await api.get("/auth/payment-methods");
  return data;
};

export const addPaymentMethod = async (method) => {
  const { data } = await api.post("/auth/payment-methods", method);
  return data;
};

export const setDefaultPaymentMethod = async (id) => {
  const { data } = await api.patch(`/auth/payment-methods/${id}/default`);
  return data;
};

export const deletePaymentMethod = async (id) => {
  const { data } = await api.delete(`/auth/payment-methods/${id}`);
  return data;
};

// ─── Preferences ──────────────────────────────────────────────
export const updateNotificationPrefs = async (prefs) => {
  const { data } = await api.patch("/auth/notification-prefs", prefs);
  return data;
};

export const updatePrivacyPrefs = async (prefs) => {
  const { data } = await api.patch("/auth/privacy-prefs", prefs);
  return data;
};

export const updateAppPrefs = async (prefs) => {
  const { data } = await api.patch("/auth/app-prefs", prefs);
  return data;
};

// ─── Rides ────────────────────────────────────────────────────
export const createRide = async (rideData) => {
  const { data } = await api.post("/rides", rideData);
  return data;
};

export const getRideHistory = async () => {
  const { data } = await api.get("/rides/my-rides");
  return data;
};

export const riderCancelRide = async (rideId, reason = "") => {
  const { data } = await api.post(`/rides/${rideId}/rider-cancel`, { reason });
  return data;
};

export const estimateFare = async (payload) => {
  const { data } = await api.post("/rides/estimate-fare", payload);
  return data;
};

export const getFareInfo = async () => {
  const { data } = await api.get("/rides/fare-info");
  return data;
};

// ─── Payments (Stripe / mock) ─────────────────────────────────
export const createRideCheckoutSession = async (rideId, payload = {}) => {
  const { data } = await api.post(
    `/rides/${rideId}/payments/checkout-session`,
    payload,
  );
  return data;
};

export const verifyRideCheckoutSession = async (sessionId, ticketId) => {
  const { data } = await api.get("/rides/payments/verify-session", {
    params: { sessionId, ticketId },
  });
  return data;
};

export const downloadRideReceipt = async (ticketId) => {
  const { data } = await api.get(
    `/rides/track/${encodeURIComponent(ticketId)}/receipt`,
    { responseType: "text" },
  );
  return data;
};

export default api;
