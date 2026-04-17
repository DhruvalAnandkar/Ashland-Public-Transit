import React, { useState, useEffect, useCallback } from "react";
import {
  getRides,
  updateRideStatus,
  getVehicles,
  updateRideVehicle,
  login,
  postDriverLocation,
} from "../services/api";
import { io } from "socket.io-client";
import config from "../config";
import {
  MapPin,
  CheckCircle,
  Clock,
  Truck,
  User,
  Hand,
  X,
  AlertTriangle,
} from "lucide-react";
import LoginModal from "./LoginModal";
import Toast from "./Toast";
import { AnimatePresence, motion } from "framer-motion";

const DriverView = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem("token"),
  );
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [myRides, setMyRides] = useState([]);
  const [availableRides, setAvailableRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [gpsLive, setGpsLive] = useState(false);
  const [gpsIssue, setGpsIssue] = useState("");

  const [confirmAction, setConfirmAction] = useState(null);
  const socketRef = React.useRef(null);
  const gpsIntervalRef = React.useRef(null);
  const gpsWatchIdRef = React.useRef(null);

  const [viewDate, setViewDate] = useState(
    new Date().toLocaleDateString("en-CA"),
  );

  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const handleLogin = async (username, password) => {
    try {
      const data = await login(username, password);
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("driverUsername", username);
        if (data._id || data.id) {
          localStorage.setItem("userId", data._id || data.id);
        }
        setIsAuthenticated(true);
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  const loadFleet = useCallback(async () => {
    try {
      const data = await getVehicles();
      setVehicles(data);
      const myUsername = localStorage.getItem("driverUsername");
      if (myUsername) {
        const assignedVehicle = data.find(
          (v) => v.assignedDriver === myUsername,
        );
        if (assignedVehicle) setSelectedVehicle(assignedVehicle.name);
      }
    } catch (e) {
      console.error("Fleet load error", e);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadFleet();
  }, [isAuthenticated, loadFleet]);

  const loadManifest = useCallback(async () => {
    if (!selectedVehicle) return;
    setLoading(true);
    try {
      const allRides = await getRides();
      const targetDateStr = viewDate;

      const myRides = allRides.filter((r) => {
        const rideDate = new Date(r.scheduledTime).toLocaleDateString("en-CA");
        const isDateMatch = rideDate === targetDateStr;
        const isMyVehicle = r.assignedVehicle === selectedVehicle;

        if (isMyVehicle)
          console.log("DriverView Match:", {
            id: r.ticketId,
            rideDate,
            targetDateStr,
            status: r.status,
          });

        return (
          isMyVehicle &&
          (r.status === "Confirmed" || r.status === "En-Route") &&
          isDateMatch
        );
      });

      const poolRides = allRides.filter((r) => {
        const rideDate = new Date(r.scheduledTime).toLocaleDateString("en-CA");
        const isDateMatch = rideDate === targetDateStr;
        const isUnassigned =
          !r.assignedVehicle ||
          r.assignedVehicle === "Unassigned" ||
          r.assignedVehicle === "" ||
          r.assignedVehicle === "Waiting Setup...";

        return isUnassigned && r.status === "Confirmed" && isDateMatch;
      });

      setMyRides(myRides);
      setAvailableRides(poolRides);
    } catch (error) {
      console.error("Manifest Error", error);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicle, viewDate]);

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = io(config.SOCKET_URL);
    socketRef.current = socket;
    const username = localStorage.getItem("driverUsername");

    socket.on("connect", () => {
      if (username) {
        socket.emit("join_driver_room", username);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !socketRef.current) return;
    const username = localStorage.getItem("driverUsername");
    if (!username || !navigator.geolocation) {
      setGpsIssue("This browser does not support geolocation.");
      return;
    }

    if (!window.isSecureContext) {
      setGpsIssue("GPS requires HTTPS or localhost. Open Driver Mode on http://localhost:3000.");
    }

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          if (result.state === "denied") {
            setGpsIssue("Location permission denied in browser settings.");
          }
        })
        .catch(() => {});
    }

    let warnedPermission = false;

    const publishPosition = async (position) => {
      const coordinates = [position.coords.longitude, position.coords.latitude];
      const currentRide =
        myRides.find((r) => r.status === "En-Route") ||
        myRides.find((r) => r.status === "Confirmed") ||
        null;

      socketRef.current?.emit("driver_gps_ping", {
        driverUsername: username,
        driverId: localStorage.getItem("userId") || null,
        vehicleName: selectedVehicle || "",
        status: currentRide ? currentRide.status : "Active",
        currentRideId: currentRide?._id || null,
        riderId: currentRide?.riderId || null,
        coordinates,
      });

      setGpsLive(true);
      setGpsIssue("");

      // REST fallback ensures rider tracking still updates if socket delivery is delayed.
      try {
        await postDriverLocation(coordinates);
      } catch {
        // Keep silent; socket path may still be healthy.
      }
    };

    const onGpsError = (error) => {
      setGpsLive(false);
      const msg = String(error?.message || "").toLowerCase();
      if (msg.includes("secure") || msg.includes("https")) {
        setGpsIssue("GPS blocked: use HTTPS or localhost origin.");
      } else if (error?.code === 1) {
        setGpsIssue("Location permission denied for this site.");
      } else if (error?.code === 2) {
        setGpsIssue("Location unavailable. Check OS location services.");
      } else if (error?.code === 3) {
        setGpsIssue("Location request timed out. Move for better signal.");
      } else {
        setGpsIssue(error?.message || "Unable to get driver location.");
      }
      if (!warnedPermission && error?.code === 1) {
        warnedPermission = true;
        addToast("Location permission is blocked in browser for driver tracking.", "error");
      }
      console.warn("Driver GPS unavailable:", error?.message || "unknown");
    };

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        publishPosition(position);
      },
      onGpsError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    // Safety heartbeat in case watch events are throttled.
    gpsIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => publishPosition(position),
        onGpsError,
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 12000,
        },
      );
    }, 10000);

    return () => {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
    };
  }, [isAuthenticated, selectedVehicle, myRides]);

  const executeUpdateStatus = async () => {
    if (!confirmAction) return;
    const { id, status } = confirmAction;

    try {
      await updateRideStatus(id, status);
      loadManifest();
      addToast(`Status updated to ${status}`, "success");
    } catch (error) {
      addToast("Error updating status", "error");
    } finally {
      setConfirmAction(null);
    }
  };

  const executeClaimRide = async () => {
    if (!confirmAction) return;
    const { id } = confirmAction;

    try {
      await updateRideVehicle(id, selectedVehicle);
      await updateRideStatus(id, "Confirmed");
      loadManifest();
      addToast("Ride Claimed Successfully", "success");
    } catch (error) {
      addToast("Error claiming ride", "error");
    } finally {
      setConfirmAction(null);
    }
  };

  const requestUpdate = (id, status) => {
    setConfirmAction({
      type: "update",
      id,
      status,
      message: `Update ride status to ${status}?`,
    });
  };

  const requestClaim = (id) => {
    setConfirmAction({
      type: "claim",
      id,
      message: `Claim ride #${id.substring(id.length - 4)} for ${selectedVehicle}?`,
    });
  };

  const changeDate = (days) => {
    const d = new Date(viewDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setViewDate(d.toLocaleDateString("en-CA"));
  };

  if (!isAuthenticated)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LoginModal
          isOpen={true}
          onClose={() => {}}
          onLogin={handleLogin}
          title="Driver Portal"
        />
      </div>
    );

  return (
    /* Animated element background — inherited from App.js gradient */
    <motion.div
      className="min-h-screen text-slate-700 p-4 pb-20 font-sans relative overflow-hidden"
    >
      {/* Slow-moving background gradient orb */}
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 500,
          height: 500,
          top: "-10%",
          left: "-10%",
          backgroundColor: "rgba(59, 130, 246, 0.08)",
          filter: "blur(80px)",
        }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 350,
          height: 350,
          bottom: "10%",
          right: "-5%",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          filter: "blur(72px)",
        }}
        animate={{ x: [0, -30, 0], y: [0, -40, 0], scale: [1, 1.05, 1] }}
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4 relative z-10">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-blue-700">
            Driver Mode
          </h1>

          <div className="flex items-center gap-3 mt-2 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-200">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => changeDate(-1)}
              className="p-1 text-slate-400 rounded hover:bg-slate-50 hover:text-blue-600 transition-colors"
            >
              ←
            </motion.button>
            <input
              type="date"
              value={viewDate}
              onChange={(e) => setViewDate(e.target.value)}
              className="bg-transparent text-slate-700 text-xs font-bold border-none outline-none cursor-pointer"
            />
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => changeDate(1)}
              className="p-1 text-slate-400 rounded hover:bg-slate-50 hover:text-blue-600 transition-colors"
            >
              →
            </motion.button>
          </div>
        </div>
        <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
             <Truck className="text-blue-500" />
        </div>
      </div>

      <div className="mb-4 relative z-10">
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wider ${
          gpsLive
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-amber-50 text-amber-700 border-amber-200"
        }`}>
          <span className={`w-2 h-2 rounded-full ${gpsLive ? "bg-emerald-500" : "bg-amber-500"}`} />
          {gpsLive ? "Driver GPS Live" : "Driver GPS Waiting"}
        </div>
        {!gpsLive && gpsIssue && (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            {gpsIssue}
          </p>
        )}
      </div>

      {/* VEHICLE SELECTOR */}
      <div className="mb-6 relative z-10">
        <select
          className="w-full p-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold outline-none ring-2 ring-transparent shadow-md focus:ring-blue-500"
          value={selectedVehicle}
          onChange={(e) => setSelectedVehicle(e.target.value)}
        >
          <option value="">-- Tap to Select Vehicle --</option>
          {vehicles.map((v) => (
            <option key={v._id} value={v.name}>
              {v.name} ({v.type})
            </option>
          ))}
        </select>
      </div>

      {!selectedVehicle ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 opacity-60 relative z-10"
        >
          <Truck size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="font-bold text-slate-500">Select a vehicle to start</p>
        </motion.div>
      ) : (
        <div className="space-y-8 relative z-10">
          {/* SECTION 1: MY ACTIVE MANIFEST */}
          <div>
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 drop-shadow-sm">
              <Truck size={14} className="text-blue-500" /> My Manifest ({myRides.length})
            </h2>
            {loading ? (
              <div className="animate-pulse h-20 bg-slate-200 rounded-xl"></div>
            ) : myRides.length === 0 ? (
              <div className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-dashed border-slate-300 text-center shadow-sm">
                <p className="text-slate-600 font-bold text-sm">
                  No active rides assigned.
                </p>
                <p className="text-[10px] text-slate-400 uppercase mt-1">
                  Check the pool below
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {myRides.map((ride) => (
                    <RideCard
                      key={ride._id}
                      ride={ride}
                      isAssigned={true}
                      onAction={requestUpdate}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* SECTION 2: AVAILABLE POOL */}
          <div>
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 drop-shadow-sm">
              <Hand size={14} className="text-amber-500" /> Available Pool ({availableRides.length})
            </h2>
            {loading ? (
              <div className="animate-pulse h-20 bg-slate-200 rounded-xl"></div>
            ) : availableRides.length === 0 ? (
              <div className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-dashed border-slate-300 text-center shadow-sm">
                <p className="text-slate-600 font-bold text-sm">
                  No Open Rides in Pool.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {availableRides.map((ride) => (
                    <RideCard
                      key={ride._id}
                      ride={ride}
                      isAssigned={false}
                      onAction={requestClaim}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div className="fixed top-4 right-4 z-[110] flex flex-col items-end">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setConfirmAction(null)}
            />
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className="bg-white border border-white max-w-sm w-full rounded-2xl p-6 relative z-10 shadow-2xl"
            >
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertTriangle className="text-amber-500" /> Confirm Action
              </h3>
              <p className="text-slate-600 font-bold mb-6">
                {confirmAction.message}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setConfirmAction(null)}
                  className="py-3 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={
                    confirmAction.type === "claim"
                      ? executeClaimRide
                      : executeUpdateStatus
                  }
                  className="py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all uppercase tracking-widest shadow-md shadow-blue-500/20"
                >
                  Confirm
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// RIDE CARD — AnimatePresence slide-out, En-Route pulse ring, spring tap
// ---------------------------------------------------------------------------
const RideCard = ({ ride, isAssigned, onAction }) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: 40 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -40, scale: 0.95 }}
    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className={`bg-white/90 backdrop-blur-xl rounded-2xl p-5 border shadow-xl relative overflow-hidden transition-all ${
      !isAssigned
        ? "border-amber-400 ring-1 ring-amber-400/20"
        : ride.status === "En-Route"
          ? "border-blue-500"
          : "border-slate-200"
    }`}
  >
    {/* EN-ROUTE PULSING RING — animated border glow */}
    {ride.status === "En-Route" && (
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-blue-400 pointer-events-none"
        animate={{ opacity: [0.6, 0.15, 0.6] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
    )}

    <div className="absolute top-0 right-0 bg-slate-800 px-3 py-1 rounded-bl-xl z-10 shadow-sm">
      <span className="text-[10px] font-mono text-white">
        #{ride.ticketId || "---"}
      </span>
    </div>

    {ride.status === "En-Route" && (
      <div className="absolute top-0 left-0 bg-blue-600 px-3 py-1 rounded-br-xl z-10">
        <span className="text-[10px] font-black text-white uppercase flex items-center gap-1">
          <Truck size={10} /> En-Route
        </span>
      </div>
    )}

    <div className="flex items-start gap-4 mb-4 mt-6">
      <div className="bg-blue-100 p-3 rounded-xl text-blue-600 shadow-sm">
        <User size={24} />
      </div>
      <div>
        <h3 className="font-black text-slate-800 text-lg">{ride.passengerName}</h3>
        <div className="flex gap-2 mt-2">
          <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            {ride.passengers} Pax
          </span>
          {ride.userType === "Elderly/Disabled" && (
            <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Priority
            </span>
          )}
        </div>
      </div>
    </div>

    <div className="space-y-3 mb-6 bg-slate-50 border border-slate-100 p-4 rounded-xl shadow-inner">
      <div className="flex gap-3">
        <Clock size={16} className="text-amber-500 mt-1" />
        <div>
          <p className="text-[10px] text-slate-400 font-black uppercase">
            Time
          </p>
          <p className="font-mono font-bold text-slate-800 text-lg">
            {new Date(ride.scheduledTime).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <MapPin size={16} className="text-emerald-500 mt-1" />
        <div className="w-full text-base">
          <p className="font-bold text-slate-700">{ride.pickup}</p>
          <div className="h-4 border-l-2 border-dashed border-slate-300 ml-2 my-1"></div>
          <p className="font-bold text-slate-700">{ride.dropoff}</p>
        </div>
      </div>
    </div>

    {!isAssigned ? (
      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        onClick={() => onAction(ride._id)}
        className="w-full py-5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 text-lg shadow-lg shadow-amber-900/20 transition-colors"
      >
        <Hand size={24} /> Claim Ride
      </motion.button>
    ) : ride.status === "Confirmed" ? (
      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        onClick={() => onAction(ride._id, "En-Route")}
        className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 text-lg shadow-lg shadow-blue-900/20 transition-colors"
      >
        <Truck size={24} /> Start Trip
      </motion.button>
    ) : (
      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        onClick={() => onAction(ride._id, "Completed")}
        className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 text-lg shadow-lg shadow-emerald-900/20 transition-colors"
      >
        <CheckCircle size={24} /> Complete
      </motion.button>
    )}
  </motion.div>
);

export default DriverView;
