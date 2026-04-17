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
        .catch(() => { });
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
          onClose={() => { }}
          onLogin={handleLogin}
          title="Driver Portal"
        />
      </div>
    );

  return (
    <motion.div className="min-h-screen text-slate-700 p-4 md:p-6 pb-20 font-sans relative overflow-hidden">
      {/* Ambient background orbs */}
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{ width: 500, height: 500, top: "-10%", left: "-10%", backgroundColor: "rgba(59, 130, 246, 0.06)", filter: "blur(80px)" }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{ width: 350, height: 350, bottom: "10%", right: "-5%", backgroundColor: "rgba(16, 185, 129, 0.06)", filter: "blur(72px)" }}
        animate={{ x: [0, -30, 0], y: [0, -40, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* ═══════════════════════════════════════════════════════════════
          PREMIUM HEADER CARD
      ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 bg-white/95 backdrop-blur-2xl rounded-[1.5rem] border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.04)] p-5 md:p-6 mb-6"
      >
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-5">
          {/* LEFT: Identity & GPS */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                <Truck size={26} className="text-white" />
              </div>
              {/* GPS Beacon */}
              <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${gpsLive ? "bg-emerald-400" : "bg-amber-400"}`}>
                {gpsLive && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-emerald-400"
                    animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
              </div>
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 uppercase tracking-wider leading-none">Driver Mode</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${gpsLive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {gpsLive ? "GPS Live" : "GPS Waiting"}
                </span>
                {selectedVehicle && (
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                    {selectedVehicle}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* CENTER: Date Navigator */}
          <div className="flex items-center h-12 bg-slate-50 border border-slate-200/60 rounded-xl p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] shrink-0">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => changeDate(-1)} className="h-full px-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all flex items-center justify-center">←</motion.button>
            <div className="flex flex-col justify-center items-center px-4 min-w-[130px] relative group h-full cursor-pointer">
              <input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
              <span className="text-[13px] font-black text-slate-800 leading-none mb-0.5 group-hover:text-blue-600 transition-colors">{new Date(viewDate + "T12:00:00").toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}</span>
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] leading-none">{new Date(viewDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}</span>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => changeDate(1)} className="h-full px-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all flex items-center justify-center">→</motion.button>
          </div>

          {/* RIGHT: Shift Stats */}
          <div className="flex items-center gap-5 shrink-0">
            <div className="flex flex-col items-end">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">My Rides</p>
              <p className="text-xl font-black text-blue-600 leading-none">{myRides.length}</p>
            </div>
            <div className="flex flex-col items-end">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Open Pool</p>
              <p className="text-xl font-black text-amber-600 leading-none">{availableRides.length}</p>
            </div>
          </div>
        </div>

        {/* GPS Issue Banner */}
        {!gpsLive && gpsIssue && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs font-bold"
          >
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            {gpsIssue}
          </motion.div>
        )}
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════
          VEHICLE SELECTOR
      ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative z-10 mb-6"
      >
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <Truck size={18} className={selectedVehicle ? "text-blue-500" : "text-slate-400"} />
          </div>
          <select
            className={`w-full pl-12 pr-4 py-4 rounded-2xl bg-white/95 backdrop-blur-xl border text-sm font-black uppercase tracking-wider outline-none shadow-sm transition-all appearance-none cursor-pointer ${selectedVehicle ? "border-blue-200 text-blue-700 ring-2 ring-blue-500/10 hover:border-blue-300" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
          >
            <option value="">— Select Your Vehicle to Begin Shift —</option>
            {vehicles.map((v) => (
              <option key={v._id} value={v.name}>{v.name} ({v.type})</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════════════ */}
      {!selectedVehicle ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-center justify-center py-24"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 border border-slate-200">
              <Truck size={40} className="text-slate-300" />
            </div>
          </motion.div>
          <p className="font-black text-slate-500 uppercase tracking-widest text-sm mb-1">No Vehicle Selected</p>
          <p className="text-xs text-slate-400 font-medium">Select a vehicle above to start your shift</p>
        </motion.div>
      ) : (
        <div className="space-y-6 relative z-10">
          {/* SECTION 1: MY ACTIVE MANIFEST */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg border border-blue-100"><Truck size={14} className="text-blue-500" /></div>
                My Manifest
                <span className="ml-1 text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-100">{myRides.length}</span>
              </h2>
            </div>
            {loading ? (
              <div className="space-y-3">
                <div className="animate-pulse h-28 bg-white/60 rounded-2xl border border-slate-100" />
                <div className="animate-pulse h-28 bg-white/60 rounded-2xl border border-slate-100" />
              </div>
            ) : myRides.length === 0 ? (
              <div className="p-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-dashed border-slate-200 text-center">
                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-16 h-16 mx-auto mb-4 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                  <Truck size={28} className="text-slate-300" />
                </motion.div>
                <p className="text-slate-600 font-bold text-sm mb-1">No Rides Assigned</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Check the available pool below</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {myRides.map((ride) => (
                    <RideCard key={ride._id} ride={ride} isAssigned={true} onAction={requestUpdate} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* SECTION 2: AVAILABLE POOL */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-100"><Hand size={14} className="text-amber-500" /></div>
                Available Pool
                <span className="ml-1 text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100">{availableRides.length}</span>
              </h2>
            </div>
            {loading ? (
              <div className="space-y-3">
                <div className="animate-pulse h-28 bg-white/60 rounded-2xl border border-slate-100" />
              </div>
            ) : availableRides.length === 0 ? (
              <div className="p-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-dashed border-slate-200 text-center">
                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-100">
                  <Hand size={28} className="text-amber-300" />
                </motion.div>
                <p className="text-slate-600 font-bold text-sm mb-1">No Open Rides</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Waiting for dispatch to assign rides</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {availableRides.map((ride) => (
                    <RideCard key={ride._id} ride={ride} isAssigned={false} onAction={requestClaim} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
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
// RIDE CARD — Premium ticket-style with status stripe, spring animations
// ---------------------------------------------------------------------------
const RideCard = ({ ride, isAssigned, onAction }) => {
  const statusConfig = {
    "En-Route": { bg: "bg-blue-500", text: "text-blue-700", label: "En-Route", lightBg: "bg-blue-50", border: "border-blue-500" },
    "Confirmed": { bg: "bg-emerald-500", text: "text-emerald-700", label: "Confirmed", lightBg: "bg-emerald-50", border: "border-emerald-500" },
    "Pending": { bg: "bg-amber-500", text: "text-amber-700", label: "Pending", lightBg: "bg-amber-50", border: "border-amber-500" },
  };
  const cfg = statusConfig[ride.status] || statusConfig["Pending"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`bg-white/95 backdrop-blur-xl rounded-2xl border shadow-sm hover:shadow-lg transition-all relative overflow-hidden ${!isAssigned ? "border-amber-200" : ride.status === "En-Route" ? "border-blue-200" : "border-slate-100"
        }`}
    >
      {/* Status color stripe */}
      <div className={`absolute top-0 left-0 w-1.5 h-full ${cfg.bg} rounded-l-2xl`} />

      {/* EN-ROUTE PULSING RING */}
      {ride.status === "En-Route" && (
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-blue-400 pointer-events-none"
          animate={{ opacity: [0.5, 0.1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="p-5 pl-6">
        {/* ROW 1: Header — Ticket ID, Passenger Name, Status Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl flex items-center justify-center border border-blue-100">
              <User size={20} className="text-blue-500" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base leading-none">{ride.passengerName}</h3>
              <p className="text-[10px] font-mono text-slate-400 mt-1">#{ride.ticketId || "---"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ride.userType === "Elderly/Disabled" && (
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-purple-50 text-purple-600 border border-purple-100">
                Priority
              </span>
            )}
            <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${cfg.lightBg} ${cfg.text} border`}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* ROW 2: Info Grid — Time, Passengers, Fare */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <Clock size={14} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase">Time</p>
              <p className="text-sm font-black text-slate-800 leading-none">
                {new Date(ride.scheduledTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <User size={14} className="text-blue-500 shrink-0" />
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase">Pax</p>
              <p className="text-sm font-black text-slate-800 leading-none">{ride.passengers || 1}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <span className="text-emerald-500 font-black text-sm shrink-0">$</span>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase">Fare</p>
              <p className="text-sm font-black text-emerald-600 leading-none">{ride.fare?.toFixed(2) || "—"}</p>
            </div>
          </div>
        </div>

        {/* ROW 3: Route */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center mt-0.5 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-emerald-200" />
              <div className="w-0.5 h-8 bg-slate-200 my-0.5" />
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 border-2 border-red-200" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate">{ride.pickup}</p>
              <div className="h-4" />
              <p className="text-xs font-bold text-slate-700 truncate">{ride.dropoff}</p>
            </div>
          </div>
        </div>

        {/* ROW 4: Action Button */}
        {!isAssigned ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            onClick={() => onAction(ride._id)}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-400 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-200/50 hover:shadow-amber-300/60 transition-shadow"
          >
            <Hand size={18} /> Claim This Ride
          </motion.button>
        ) : ride.status === "Confirmed" ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            onClick={() => onAction(ride._id, "En-Route")}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-200/50 hover:shadow-blue-300/60 transition-shadow"
          >
            <Truck size={18} /> Start Trip
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            onClick={() => onAction(ride._id, "Completed")}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-200/50 hover:shadow-emerald-300/60 transition-shadow"
          >
            <CheckCircle size={18} /> Complete Ride
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

export default DriverView;
