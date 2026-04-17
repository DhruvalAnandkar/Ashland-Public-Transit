import React, { useState, useEffect, useMemo, useRef } from "react";
import LiveFleetMap from "./LiveFleetMap";
import {
  getRides,
  updateRideStatus,
  updateRideVehicle,
  getVehicles,
  updateRideDetails,
  createRide,
  getAutoAccept,
  updateAutoAccept,
  getAuditLogs,
  updateVehicleDriver,
  getDrivers,
  getOperationsSnapshot,
} from "../services/api";
import {
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  Phone,
  Search,
  Truck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Ticket,
  CircleDollarSign,
  Ban,
  Pencil,
  Plus,
  BarChart3,
  Settings,
  PieChart,
  Activity,
  FileText,
  ShieldCheck,
  Download,
  Map,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePie,
  Pie,
  Cell,
} from "recharts";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  animate as motionAnimate,
} from "framer-motion";
import Toast from "./Toast";
import { io } from "socket.io-client";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// ---------------------------------------------------------------------------
// ANIMATED NUMBER — count-up effect using Framer Motion primitives.
// useMotionValue tracks the raw numeric value; useTransform formats it for
// display; motionAnimate drives the value from its previous to current on change.
// ---------------------------------------------------------------------------
const AnimatedNumber = ({ value, decimals = 0, prefix = "", suffix = "" }) => {
  const motionValue = useMotionValue(0);
  const display = useTransform(
    motionValue,
    (v) =>
      `${prefix}${decimals > 0 ? v.toFixed(decimals) : Math.round(v)}${suffix}`,
  );

  useEffect(() => {
    const controls = motionAnimate(motionValue, value, {
      duration: 0.75,
      ease: "easeOut",
    });
    // Return stop so the animation cancels cleanly if value changes mid-flight
    return controls.stop;
  }, [value, motionValue]);

  // motion.span subscribes to the MotionValue and updates the DOM directly,
  // bypassing React reconciler for smooth sub-frame updates.
  return <motion.span>{display}</motion.span>;
};

const DispatcherDashboard = () => {
  const [rides, setRides] = useState([]);
  const [vehicles, setVehicles] = useState([]); // Dynamic Fleet
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingRide, setEditingRide] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("manifest"); // 'manifest' | 'reports'
  const [autoAccept, setAutoAccept] = useState(false); // Global Setting
  const [toasts, setToasts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  // Confirmation State
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

  // ── DRIVER CHAT MODAL ──────────────────────────────────────────
  const [chatModal, setChatModal] = useState(null); // { driverName, driverId }
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const chatSocketRef = useRef(null);
  const chatBottomRef = useRef(null);

  const openChat = (driverName, driverId) => {
    setChatModal({ driverName, driverId });
    setChatMessages([]);
    const room = `room_driver_${driverId}`;
    const socket = io("http://localhost:5000");
    chatSocketRef.current = socket;
    socket.emit("join_room", room);
    socket.on("chat_message", (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });
  };

  const closeChat = () => {
    chatSocketRef.current?.disconnect();
    chatSocketRef.current = null;
    setChatModal(null);
    setChatMessages([]);
    setChatInput("");
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text || !chatModal) return;
    const room = `room_driver_${chatModal.driverId}`;
    const msg = { from: "Dispatcher", text, ts: new Date().toLocaleTimeString() };
    chatSocketRef.current?.emit("chat_message", { room, ...msg });
    setChatMessages((prev) => [...prev, msg]);
    setChatInput("");
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  // ── EDIT DRIVER MODAL ─────────────────────────────────────────
  const [editDriverModal, setEditDriverModal] = useState(null); // driver object
  const [editDriverLoading, setEditDriverLoading] = useState(false);

  const openEditDriver = (driver) => setEditDriverModal({ ...driver });

  const saveEditDriver = async () => {
    setEditDriverLoading(true);
    try {
      await fetch(`http://localhost:5000/api/rides/fleet/drivers/${editDriverModal._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({
          fullName: editDriverModal.fullName,
          phoneNumber: editDriverModal.phoneNumber,
          licenseNumber: editDriverModal.licenseNumber,
          tags: editDriverModal.tags,
        }),
      });
      addToast("Driver updated", "success");
      setEditDriverModal(null);
      fetchData();
    } catch {
      addToast("Update failed", "error");
    } finally {
      setEditDriverLoading(false);
    }
  };

  // REAL-TIME VISUAL EFFECTS
  // isFirstLoad: controls entrance animation direction.
  //   true  → cards animate from y:10 (initial page load, subtle rise)
  //   false → new cards animate from x:60 (slide in from right, socket-pushed)
  const isFirstLoad = useRef(true);
  // recentlyUpdatedId: the ride._id whose card should flash a gold glow pulse.
  // Set by the socket ride_updated listener; auto-cleared after 2 seconds.
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState(null);

  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // EXPERT DATE MATCHER: Prevents the "Empty Graph" by ignoring UTC offsets
  const [viewDate, setViewDate] = useState(dayjs().format("YYYY-MM-DD"));

  const [driversList, setDriversList] = useState([]); // List of users with role 'Driver'
  const [opsSnapshot, setOpsSnapshot] = useState({ drivers: [], riders: [] });

  const fetchData = async () => {
    try {
      const [
        ridesData,
        vehiclesData,
        autoAcceptData,
        auditLogsData,
        driversData,
        operationsData,
      ] = await Promise.all([
        getRides(),
        getVehicles(),
        getAutoAccept(),
        getAuditLogs(),
        getDrivers(),
        getOperationsSnapshot(),
      ]);
      setRides(ridesData);
      setVehicles(vehiclesData);
      setAutoAccept(autoAcceptData.autoAccept);
      setAuditLogs(auditLogsData || []);
      setDriversList(driversData || []);
      setOpsSnapshot({
        drivers: operationsData?.drivers || [],
        riders: operationsData?.riders || [],
      });
      setLoading(false);
      // After the first successful data fetch, subsequent new cards that arrive
      // via socket should slide in from the right rather than rise from below.
      isFirstLoad.current = false;
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  // CSV EXPORT GENERATOR
  const downloadMonthlyReport = () => {
    const headers = [
      "Ticket ID",
      "Date",
      "Passenger",
      "Type",
      "Status",
      "Fare",
      "Payment",
    ];
    const currentMonth = new Date().getMonth();

    const completedRides = rides.filter(
      (r) =>
        (r.status === "Completed" || r.status === "Confirmed") &&
        new Date(r.scheduledTime).getMonth() === currentMonth,
    );

    const csvContent = [
      headers.join(","),
      ...completedRides.map((r) =>
        [
          r.ticketId,
          new Date(r.scheduledTime).toLocaleDateString(),
          `"${r.passengerName}"`,
          r.userType,
          r.status,
          (r.finalizedFare || r.fare).toFixed(2),
          r.paymentStatus || "Pending",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ashland_Transit_Report_${new Date().toISOString().slice(0, 7)}.csv`;
    a.click();
  };

  useEffect(() => {
    fetchData();

    // POLL: Fallback — keeps manifest in sync every 10 seconds
    // even if a socket event is missed (e.g. server restart, network blip)
    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // REAL-TIME: Socket connection for instant manifest updates
  // Connects once on mount, joins the dispatcher room, and listens for
  // ride_updated events emitted by the server after POST /rides and PATCH /:id/status
  useEffect(() => {
    const socket = io("http://localhost:5000");

    socket.on("connect", () => {
      socket.emit("join_dispatcher_room");
      console.log("Dispatcher socket connected:", socket.id);
    });

    // Server emits 'ride_updated' with the full ride document after any creation
    // or status change. We capture the ride._id to trigger the gold glow pulse
    // on that specific card, then re-fetch the full manifest to sync all stats.
    socket.on("ride_updated", (updatedRide) => {
      if (updatedRide?._id) {
        // Mark this card for a 2-second gold border glow, then clear
        setRecentlyUpdatedId(updatedRide._id);
        setTimeout(() => setRecentlyUpdatedId(null), 2000);
      }
      // Mark first-load as done so subsequent new cards slide in from the right
      isFirstLoad.current = false;
      fetchData();
    });

    socket.on("disconnect", () => {
      console.log("Dispatcher socket disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // NEW: Handle Manual Booking
  const handleManualBooking = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const rideData = {
      passengerName: formData.get("passengerName"),
      phoneNumber: formData.get("phoneNumber"),
      pickup: formData.get("pickup"),
      pickupDetails: formData.get("pickupDetails"), // Capture specific notes
      dropoff: formData.get("dropoff"),
      scheduledTime: formData.get("scheduledTime"),
      userType: formData.get("userType"),
      passengers: parseInt(formData.get("passengers")),
      isSameDay: false, // Default for manual
      isOutOfTown: false, // Default
      mileage: 0, // Default to 0, or could ask
      // Logic: Dispatcher bookings start as 'Pending Review' so logic still holds
    };

    try {
      await createRide(rideData);
      setIsBookingModalOpen(false);
      fetchData();
      await createRide(rideData);
      setIsBookingModalOpen(false);
      fetchData();
      addToast("Booking Created Successfully", "success");
    } catch (error) {
      addToast("Error creating booking: " + error.message, "error");
    }
  };

  // --- EXPERT ENGINE: LOCALIZED SYNC & PRIORITY SORTING ---
  const processedData = useMemo(() => {
    const stats = Array(24).fill(0);

    // Calculate Active Fleet Capacity (Total - In Shop)
    const activeVehiclesCount =
      vehicles.filter((v) => v.status === "Active").length || 7; // Fallback to 7 if loading

    const filtered = rides
      .filter((ride) => {
        // STRICT DATE HANDSHAKE using dayjs
        const rideDate = dayjs(ride.scheduledTime).format("YYYY-MM-DD");
        const isDateMatch = rideDate === viewDate;

        const matchesSearch =
          ride.passengerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ride.phoneNumber.includes(searchTerm);

        return isDateMatch && matchesSearch;
      })
      // PRIORITY SORTING: Elderly first, then by booking sequence (First-Come First-Served)
      .sort((a, b) => {
        if (
          a.userType === "Elderly/Disabled" &&
          b.userType !== "Elderly/Disabled"
        )
          return -1;
        if (
          a.userType !== "Elderly/Disabled" &&
          b.userType === "Elderly/Disabled"
        )
          return 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

    // GHOST GRAPH FIX: Iterate the ALREADY FILTERED list to build stats
    // We trust 'filtered' only contains rides for 'viewDate', so we just grab the hour.
    filtered.forEach((ride) => {
      if (ride.status === "Confirmed" || ride.status === "En-Route") {
        const hour = new Date(ride.scheduledTime).getHours();
        if (hour >= 0 && hour < 24) {
          stats[hour]++;
        }
      }
    });

    return { filtered, stats, activeVehiclesCount };
  }, [rides, viewDate, searchTerm, vehicles]);

  const hourlyFleetUsage = processedData.stats;
  const activeVehiclesCount = processedData.activeVehiclesCount;

  // COMPREHENSIVE UPDATE HANDLER
  const handleStatusUpdate = async (id, newStatus, rideTime) => {
    const update = async () => {
      try {
        await updateRideStatus(id, newStatus);
        fetchData();
        addToast(`Ride ${newStatus}`, "success");
      } catch (e) {
        addToast("Update Failed", "error");
      }
    };

    if (newStatus === "Confirmed") {
      const hour = dayjs(rideTime).hour();
      const currentConfirmedInHour = hourlyFleetUsage[hour] || 0;
      if (currentConfirmedInHour >= activeVehiclesCount) {
        setConfirmAction({
          message: `⚠️ OVERBOOKING WARNING: This hour is already full (${currentConfirmedInHour}/${activeVehiclesCount}). Force confirm anyway?`,
          onConfirm: () => {
            update();
            setConfirmAction(null);
          },
        });
        return;
      }
    }

    // CANCELLATION CHECK
    if (newStatus === "Cancelled") {
      setConfirmAction({
        message:
          "EMERGENCY CANCEL: This will immediately free up fleet capacity. Proceed?",
        onConfirm: () => {
          update();
          setConfirmAction(null);
        },
      });
      return;
    }

    // Standard Update (No confirm needed for regular status changes unless critical)
    update();
  };

  const handleVehicleAssign = async (id, vehicle) => {
    try {
      await updateRideVehicle(id, vehicle);
      fetchData();
      addToast("Vehicle Assigned", "success");
    } catch (e) {
      addToast("Assignment Failed", "error");
    }
  };

  const peakUsage = Math.max(...hourlyFleetUsage);
  const dailyRevenue = processedData.filtered.reduce(
    (acc, r) =>
      r.status === "Confirmed" || r.status === "Completed" ? acc + r.fare : acc,
    0,
  );

  if (loading)
    return (
      <div className="p-10 text-center font-bold text-blue-600 animate-pulse tracking-widest uppercase">
        Syncing Manifest...
      </div>
    );

  return (
    <div className="max-w-[1400px] w-full mx-auto space-y-6 pb-20 font-sans px-4">
      {/* CRITICAL OVERBOOK ALERT - FIXED TOP */}
      {peakUsage > activeVehiclesCount && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce">
          <ShieldAlert size={32} className="text-white" />
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest">
              Critial Overbooking
            </h2>
            <p className="font-bold text-xs opacity-90">
              {peakUsage} rides exceed fleet capacity of {activeVehiclesCount}.
            </p>
          </div>
        </div>
      )}

      {/* COMPACT DASHBOARD HEADER */}
      <div className="flex flex-wrap items-center justify-between bg-white/95 backdrop-blur-2xl p-4 md:px-6 md:py-5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 gap-4 mt-6 relative z-30">

        {/* LEFT COMPONENT: DATE & MANUAL REVIEW */}
        <div className="flex items-center gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-1.5 rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] relative overflow-hidden"
          >
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear", repeatDelay: 1 }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full pointer-events-none"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setViewDate(dayjs(viewDate).subtract(1, "day").format("YYYY-MM-DD"));
              }}
              className="p-2.5 bg-white rounded-xl shadow-sm text-slate-400 hover:text-blue-600 transition-colors relative z-10"
            >
              <ChevronLeft size={16} strokeWidth={3} />
            </motion.button>

            <motion.div whileHover={{ y: -2 }} className="flex flex-col items-center px-4 relative z-10">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={viewDate}
                  onChange={(e) => setViewDate(e.target.value)}
                  className="font-black text-[14px] outline-none bg-transparent cursor-pointer text-slate-800 uppercase"
                />
              </div>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.14em] mt-0.5 pointer-events-none">
                {new Date(viewDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "long" })}
              </span>
            </motion.div>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setViewDate(dayjs(viewDate).add(1, "day").format("YYYY-MM-DD"));
              }}
              className="p-2.5 bg-white rounded-xl shadow-sm text-slate-400 hover:text-blue-600 transition-colors relative z-10"
            >
              <ChevronRight size={16} strokeWidth={3} />
            </motion.button>
          </motion.div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              const newState = !autoAccept;
              setAutoAccept(newState);
              await updateAutoAccept(newState);
              addToast(`Auto-Accept ${newState ? "Enabled" : "Disabled"}`, "success");
            }}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl border transition-colors font-black text-[11px] uppercase tracking-[0.1em] shadow-sm ${autoAccept ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            <Settings size={14} className={autoAccept ? "animate-spin-slow text-emerald-500" : "text-slate-400"} />
            {autoAccept ? "Auto-Confirm ON" : "Manual Review"}
          </motion.button>
        </div>

        {/* MIDDLE COMPONENT: VIEW TABS */}
        <div className="flex p-1.5 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner overflow-x-auto mx-auto lg:mx-0 relative">
          {[{ id: "manifest", label: "Manifest" }, { id: "map", label: "Live Map", icon: Map }, { id: "reports", label: "Reports", icon: BarChart3 }].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative whitespace-nowrap px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] flex items-center gap-2 transition-colors z-10 ${activeTab === tab.id ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-tab-indicator"
                  className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-100/50 -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {tab.icon && <tab.icon size={14} />}
              {tab.label}
            </button>
          ))}
        </div>

        {/* RIGHT COMPONENT: STATS & ACTION BUTTONS */}
        <div className="flex items-center gap-6 hidden xl:flex">
          <div className="flex flex-col items-end">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">
              Revenue
            </p>
            <p className="text-2xl font-black text-emerald-600 tracking-tight leading-none drop-shadow-sm">
              <AnimatedNumber value={dailyRevenue} decimals={2} prefix="$" />
            </p>
          </div>

          <div className="flex flex-col items-end">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">
              Active Fleet
            </p>
            <p className={`text-2xl font-black tracking-tight leading-none drop-shadow-sm ${activeVehiclesCount < vehicles.length ? "text-amber-600" : "text-blue-900"}`}>
              <AnimatedNumber value={activeVehiclesCount} />
              <span className="text-[13px] text-slate-400 font-bold ml-1">/ {vehicles.length || 7}</span>
            </p>
          </div>

          <div className="flex flex-col items-end justify-center">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
              Ops Visibility
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex items-center bg-blue-50 border border-blue-200/60 rounded-full px-2.5 py-1 shadow-sm group hover:scale-105 transition-transform cursor-default">
                <UserCheck size={10} className="text-blue-500 mr-1.5 group-hover:text-blue-600 transition-colors" />
                <span className="text-[10px] font-black text-blue-700">{opsSnapshot.riders.length}</span>
              </div>
              <div className="flex items-center bg-indigo-50 border border-indigo-200/60 rounded-full px-2.5 py-1 shadow-sm group hover:scale-105 transition-transform cursor-default">
                <Truck size={10} className="text-indigo-500 mr-1.5 group-hover:text-indigo-600 transition-colors" />
                <span className="text-[10px] font-black text-indigo-700">{opsSnapshot.drivers.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsBookingModalOpen(true)}
            className="w-14 h-14 bg-emerald-500 text-white rounded-full shadow-[0_8px_20px_rgba(16,185,129,0.3)] hover:bg-emerald-400 transition-all font-black flex items-center justify-center hover:scale-105 active:scale-95"
            title="Book a Ride"
          >
            <Plus size={24} strokeWidth={3} />
          </button>

          <button
            onClick={() => {
              const headers = [
                "TicketID",
                "Passenger",
                "Status",
                "Pickup",
                "Dropoff",
                "Time (CA-EN)",
                "Vehicle",
                "Fare",
              ];
              const csvRows = processedData.filtered.map((r) =>
                [
                  r.ticketId || "N/A",
                  `"${r.passengerName}"`,
                  r.status,
                  `"${r.pickup}"`,
                  `"${r.dropoff}"`,
                  new Date(r.scheduledTime).toLocaleString("en-CA"),
                  r.assignedVehicle || "Unassigned",
                  r.fare.toFixed(2),
                ].join(","),
              );

              const totalRevenue = processedData.filtered
                .filter(
                  (r) => r.status === "Confirmed" || r.status === "Completed",
                )
                .reduce((sum, r) => sum + r.fare, 0);

              csvRows.push(`,,,,,,TOTAL REVENUE,$${totalRevenue.toFixed(2)}`);

              const csvContent = [headers.join(","), ...csvRows].join("\n");
              const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
              });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = `Ashland_Manifest_${viewDate}.csv`;
              link.click();
            }}
            className="w-14 h-14 bg-blue-900 text-white rounded-full shadow-[0_8px_20px_rgba(30,58,138,0.3)] hover:bg-blue-800 transition-all font-black flex items-center justify-center hover:scale-105 active:scale-95"
            title="Export Manifest CSV"
          >
            <UserCheck size={22} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* VIEW SWITCHER */}
      {activeTab === "map" ? (
        <div className="-mx-4 sm:-mx-6 lg:-mx-8">
          <LiveFleetMap />
        </div>
      ) : activeTab === "manifest" ? (
        <>
          {/* DYNAMIC HEATMAP */}
          <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            {/* ... (Existing Heatmap Logic Kept via direct inclusion or we assume it was here) ... */}
            {/* NOTE: To save complexity, I am keeping the Heatmap as part of the Manifest view because it's operational */}
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest mb-2">
                  <Clock size={14} className="text-blue-500" /> Fleet Deployment
                  Graph
                </h3>
                {/* HOURLY LOAD SUMMARY */}
                <div className="flex gap-2 overflow-x-auto pb-2 max-w-2xl no-scrollbar mask-gradient-r">
                  {hourlyFleetUsage.map((count, h) => {
                    if (count === 0) return null;
                    const timeLabel =
                      h > 12 ? `${h - 12} PM` : h === 12 ? "12 PM" : `${h} AM`;
                    return (
                      <span
                        key={h}
                        className="text-[10px] font-bold bg-white/80 text-slate-600 px-3 py-1.5 rounded-lg whitespace-nowrap border border-slate-100 shadow-sm"
                      >
                        {timeLabel}:{" "}
                        <span className="text-blue-600">
                          {count} Ride{count !== 1 && "s"}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-end h-32 border-b border-slate-200/50 pb-0 gap-2 px-2">
              {hourlyFleetUsage.slice(6, 22).map((usage, i) => {
                const hourLabel = i + 6;
                const barColor =
                  usage > activeVehiclesCount
                    ? "bg-red-500 shadow-red-200"
                    : usage === activeVehiclesCount
                      ? "bg-amber-400 shadow-amber-200"
                      : "bg-blue-500 shadow-blue-200";

                const heightPercentage = Math.max(
                  (usage / (activeVehiclesCount || 7)) * 100,
                  4,
                );

                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end h-full gap-2 group relative min-w-[20px]"
                  >
                    {usage > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] font-black text-slate-600 mb-1"
                      >
                        {usage}
                      </motion.div>
                    )}
                    <div
                      className={`w-full rounded-t-lg transition-all duration-700 ${barColor} shadow-lg opacity-90 hover:opacity-100`}
                      style={{ height: `${heightPercentage}%` }}
                    ></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase absolute -bottom-6">
                      {hourLabel > 12 ? `${hourLabel - 12}` : hourLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SEARCH */}
          <div className="relative mt-8">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
              size={16}
            />
            <input
              type="text"
              placeholder="Quick-search names or phone numbers..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm outline-none text-sm font-medium"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* MANIFEST LISTING */}
          <div className="grid gap-3">
            <AnimatePresence mode="popLayout">
              {processedData.filtered.length > 0 ? (
                processedData.filtered.map((ride, index) => {
                  const d = new Date(ride.scheduledTime);
                  const isOverbooked =
                    ride.status === "Confirmed" &&
                    hourlyFleetUsage[d.getHours()] > 7;
                  const isElderly = ride.userType === "Elderly/Disabled";

                  return (

                    <motion.div
                      layout
                      key={ride._id}
                      initial={isFirstLoad.current ? { opacity: 0, scale: 0.95, y: 10 } : { opacity: 0, x: 60 }}
                      animate={{
                        opacity: 1, x: 0, scale: 1, y: 0,
                        ...(recentlyUpdatedId === ride._id ? { boxShadow: ["0 0 0 0px rgba(251, 191, 36, 0)", "0 0 0 4px rgba(251, 191, 36, 0.9)", "0 0 0 8px rgba(251, 191, 36, 0.3)", "0 0 0 0px rgba(251, 191, 36, 0)"] } : { boxShadow: "0 0 0 0px rgba(251, 191, 36, 0)" }),
                      }}
                      exit={{ opacity: 0, x: -30, scale: 0.95 }}
                      transition={{
                        duration: 0.35, delay: isFirstLoad.current ? index * 0.04 : 0, ease: [0.22, 1, 0.36, 1],
                        ...(recentlyUpdatedId === ride._id && { boxShadow: { duration: 2, ease: "easeOut", times: [0, 0.25, 0.6, 1] } }),
                      }}
                      className={`relative bg-white/95 backdrop-blur-xl p-5 md:p-6 rounded-[1.5rem] border hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-slate-300 transition-all group overflow-hidden ${ride.status === 'Confirmed' ? 'border-emerald-100' :
                          ride.status === 'En-Route' ? 'border-blue-100' :
                            ride.status === 'Rejected' ? 'border-red-100' :
                              ride.status === 'Completed' ? 'border-teal-100' :
                                'border-slate-100'
                        } ${isOverbooked ? 'ring-2 ring-red-500/50' : ''}`}
                    >
                      {/* Left color stripe indicator */}
                      <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${ride.status === 'Confirmed' ? 'bg-emerald-500' :
                          ride.status === 'En-Route' ? 'bg-blue-500' :
                            ride.status === 'Rejected' ? 'bg-red-500' :
                              ride.status === 'Completed' ? 'bg-teal-500' :
                                ride.status === 'Cancelled' ? 'bg-slate-300' :
                                  'bg-amber-400'
                        }`} />

                      <div className="flex flex-col lg:flex-row justify-between gap-6 pl-2">
                        {/* LEFT: Core Identity & Route */}
                        <div className="flex-1 space-y-4 w-full">
                          {/* Header row */}
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[10px] font-black tracking-widest bg-slate-900 text-white px-2.5 py-1 rounded-md shadow-sm">
                              {ride.ticketId || `TKT-${index + 100}`}
                            </span>
                            <h4 className="font-extrabold text-slate-800 text-lg tracking-tight m-0 leading-none">
                              {ride.passengerName}
                            </h4>
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm border ${ride.status === 'Confirmed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                ride.status === 'En-Route' ? 'bg-blue-50 border-blue-100 text-blue-700 animate-pulse' :
                                  ride.status === 'Completed' ? 'bg-teal-50 border-teal-100 text-teal-700' :
                                    ride.status === 'Rejected' || ride.status === 'Cancelled' ? 'bg-slate-50 border-slate-200 text-slate-500' :
                                      'bg-amber-50 border-amber-100 text-amber-700'
                              }`}>
                              {ride.status}
                            </span>
                            {isElderly && (
                              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-1 rounded-md text-[9px] font-black tracking-wider flex items-center gap-1 shadow-sm">
                                <UserCheck size={10} /> PRIORITY
                              </span>
                            )}
                            {isOverbooked && (
                              <span className="bg-red-500 text-white px-2 py-1 rounded-md text-[9px] font-black tracking-wider animate-bounce flex items-center gap-1 shadow-sm">
                                <ShieldAlert size={10} /> FLEET FULL
                              </span>
                            )}
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 border border-slate-100">
                                <Clock size={14} />
                              </div>
                              <span className="font-bold text-slate-700">
                                {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 border border-slate-100">
                                <Phone size={14} />
                              </div>
                              <span className="font-medium">{ride.phoneNumber}</span>
                            </div>
                            <div className="flex items-start gap-2 sm:col-span-2 md:col-span-3">
                              <div className="p-1.5 bg-blue-50 rounded-lg text-blue-500 border border-blue-100 mt-0.5 shrink-0">
                                <MapPin size={14} />
                              </div>
                              <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                                <span className="font-bold text-slate-700 truncate max-w-[200px] bg-slate-50 px-2 py-1 rounded-md border border-slate-100 text-[11px] uppercase tracking-wide" title={ride.pickup}>
                                  {ride.pickup.replace(/Location \(/g, '(')}
                                </span>
                                <span className="text-slate-300 font-bold shrink-0">→</span>
                                <span className="font-bold text-slate-700 truncate max-w-[200px] bg-slate-50 px-2 py-1 rounded-md border border-slate-100 text-[11px] uppercase tracking-wide" title={ride.dropoff}>
                                  {ride.dropoff.replace(/Location \(/g, '(')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: Operations & Assignment */}
                        <div className="flex flex-col sm:flex-row lg:flex-col justify-between items-start sm:items-center lg:items-end gap-5 lg:gap-3 lg:border-l border-slate-100 lg:pl-6 lg:min-w-[340px] shrink-0">

                          {/* Top Right: Assignment & Fare */}
                          <div className="w-full flex justify-between items-start lg:items-center gap-4">
                            <div className="flex-1 w-full max-w-[200px] relative">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                Assigned Vehicle
                              </p>
                              <select
                                value={ride.assignedVehicle || 'Unassigned'}
                                onChange={(e) => handleVehicleAssign(ride._id, e.target.value)}
                                className={`w-full text-[10px] font-black uppercase tracking-wider border rounded-xl pl-3 pr-8 py-2.5 outline-none appearance-none cursor-pointer transition-colors ${ride.assignedVehicle ? 'bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-300 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                                  }`}
                              >
                                <option value="Unassigned">-- Select Asset --</option>
                                {vehicles.length > 0 ? vehicles.map((v) => <option key={v._id} value={v.name}>{v.name} ({v.type})</option>) : (
                                  <>
                                    <option value="Large Van (5)">Large Van (5)</option>
                                    <option value="Small Car (2)">Small Car (2)</option>
                                  </>
                                )}
                              </select>
                              <div className={`absolute right-3 top-8 pointer-events-none ${ride.assignedVehicle ? 'text-blue-500' : 'text-slate-400'}`}>
                                <Truck size={12} />
                              </div>
                              {/* Driver Badge */}
                              {(() => {
                                const v = vehicles.find((veh) => veh.name === ride.assignedVehicle);
                                if (v && v.assignedDriver) {
                                  return (
                                    <div className="absolute -bottom-3 left-2 flex items-center gap-1 text-[8px] font-black text-white bg-blue-600 px-2 py-0.5 rounded-full shadow-md z-10">
                                      <UserCheck size={10} /> {v.assignedDriver}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            <div className="text-right shrink-0 flex flex-col items-end pt-1">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{ride.passengers} Pax</p>
                              <p className="text-2xl font-black text-emerald-600 tracking-tight leading-none">${ride.fare.toFixed(2)}</p>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider mt-1 ${ride.paymentStatus === 'Paid' ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'}`}>
                                {ride.paymentStatus || 'Pending'}
                              </span>
                            </div>
                          </div>

                          {/* Bottom Right: Quick Actions */}
                          <div className="flex items-center gap-2 w-full justify-end pt-2 mt-auto">
                            <button onClick={() => {
                              const origin = encodeURIComponent(ride.pickup + ', Ashland, OH');
                              const dest = encodeURIComponent(ride.dropoff + ', Ashland, OH');
                              window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`, '_blank');
                            }} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors border border-slate-100 hover:border-blue-200" title="Smart Map">
                              <MapPin size={16} />
                            </button>
                            {(() => {
                              const v = vehicles.find((veh) => veh.name === ride.assignedVehicle);
                              if (!v?.assignedDriver) return null;
                              const driver = driversList.find((d) => d.username === v.assignedDriver);
                              return (
                                <button onClick={() => openChat(v.assignedDriver, driver?._id || v.assignedDriver)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors border border-slate-100 hover:border-emerald-200" title="Chat with Driver">
                                  <Phone size={16} />
                                </button>
                              );
                            })()}
                            <button onClick={() => setEditingRide(ride)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-colors border border-slate-100 hover:border-amber-200" title="Edit Details">
                              <Pencil size={16} />
                            </button>
                            <button onClick={() => handleStatusUpdate(ride._id, 'Confirmed', ride.scheduledTime)} className="px-3 py-2 bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-wider rounded-lg hover:bg-emerald-500 hover:text-white transition-all shadow-sm border border-emerald-100 flex items-center gap-1.5" title="Confirm Ride">
                              <CheckCircle size={14} /> Confirm
                            </button>
                            {ride.status === 'Confirmed' || ride.status === 'En-Route' ? (
                              <button onClick={() => handleStatusUpdate(ride._id, 'Cancelled')} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors border border-slate-100 hover:border-red-200" title="Emergency Cancel">
                                <Ban size={16} />
                              </button>
                            ) : (
                              <button onClick={() => handleStatusUpdate(ride._id, 'Rejected')} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors border border-slate-100 hover:border-red-200" title="Reject Request">
                                <XCircle size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>

                  );
                })
              ) : (
                <div className="py-20 text-center bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">
                    Empty Manifest for {viewDate}
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </>
      ) : (
        // --- REPORTS & ANALYTICS VIEW ---
        (() => {
          // ── COMPUTED ANALYTICS DATA ─────────────────────────────────
          const totalRides = rides.length;
          const completedRides = rides.filter(r => r.status === "Completed");
          const confirmedRides = rides.filter(r => r.status === "Confirmed");
          const cancelledRides = rides.filter(r => r.status === "Cancelled" || r.status === "Rejected");
          const enRouteRides = rides.filter(r => r.status === "En-Route");
          const pendingRides = rides.filter(r => r.status === "Pending" || r.status === "Pending Review");

          const completionRate = totalRides > 0 ? ((completedRides.length / totalRides) * 100).toFixed(1) : 0;
          const cancellationRate = totalRides > 0 ? ((cancelledRides.length / totalRides) * 100).toFixed(1) : 0;
          const avgFare = totalRides > 0 ? (rides.reduce((s, r) => s + (r.fare || 0), 0) / totalRides).toFixed(2) : "0.00";
          const totalRevenue = rides.reduce((s, r) => s + (r.status === "Completed" || r.status === "Confirmed" ? r.fare : 0), 0);
          const invoicedRevenue = rides.reduce((s, r) => s + (r.paymentStatus === "Invoiced" ? (r.finalizedFare || r.fare) : 0), 0);
          const collectionRate = totalRevenue > 0 ? Math.min(((invoicedRevenue / totalRevenue) * 100), 100).toFixed(0) : 0;

          // Passenger demographics
          const elderlyRides = rides.filter(r => r.userType === "Elderly/Disabled").length;
          const generalRides = rides.filter(r => r.userType === "General").length;
          const childRides = rides.filter(r => r.userType === "Child").length;
          const totalPax = rides.reduce((s, r) => s + (r.passengers || 1), 0);

          // Status distribution for Pie Chart
          const STATUS_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];
          const statusDistribution = [
            { name: "Completed", value: completedRides.length },
            { name: "Confirmed", value: confirmedRides.length },
            { name: "Pending", value: pendingRides.length },
            { name: "Cancelled", value: cancelledRides.length },
            { name: "En-Route", value: enRouteRides.length },
          ].filter(s => s.value > 0);

          // Rider type for pie
          const RIDER_COLORS = ["#6366f1", "#f97316", "#14b8a6"];
          const riderDistribution = [
            { name: "General", value: generalRides },
            { name: "Elderly/Disabled", value: elderlyRides },
            { name: "Child", value: childRides },
          ].filter(s => s.value > 0);

          // Top Routes
          const routeMap = {};
          rides.forEach(r => {
            const key = `${r.pickup?.substring(0, 20)} → ${r.dropoff?.substring(0, 20)}`;
            routeMap[key] = (routeMap[key] || 0) + 1;
          });
          const topRoutes = Object.entries(routeMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

          // Daily ride counts for last 7 days
          const last7Days = [];
          for (let i = 6; i >= 0; i--) {
            const day = dayjs().subtract(i, "day");
            const dayStr = day.format("YYYY-MM-DD");
            const dayLabel = day.format("ddd");
            const count = rides.filter(r => dayjs(r.scheduledTime).format("YYYY-MM-DD") === dayStr).length;
            last7Days.push({ day: dayLabel, rides: count });
          }

          // Driver workload
          const driverWorkload = {};
          vehicles.forEach(v => {
            if (v.assignedDriver) {
              const driverRides = rides.filter(r => r.assignedVehicle === v.name && (r.status === "Completed" || r.status === "Confirmed" || r.status === "En-Route"));
              driverWorkload[v.assignedDriver] = (driverWorkload[v.assignedDriver] || 0) + driverRides.length;
            }
          });
          const driverPerformance = Object.entries(driverWorkload).map(([name, count]) => ({ name, rides: count })).sort((a, b) => b.rides - a.rides);

          return (
            <div className="space-y-8 animate-in fade-in">
              {/* ROW 1: KEY PERFORMANCE INDICATORS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl border border-emerald-100"><Activity size={18} /></div>
                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">{completionRate}%</span>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Completion Rate</p>
                  <p className="text-2xl font-black text-slate-800"><AnimatedNumber value={completedRides.length} /> <span className="text-sm text-slate-400 font-bold">/ {totalRides}</span></p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-red-50 text-red-500 rounded-xl border border-red-100"><Ban size={18} /></div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${parseFloat(cancellationRate) > 20 ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50'}`}>{cancellationRate}%</span>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Cancellation Rate</p>
                  <p className="text-2xl font-black text-slate-800"><AnimatedNumber value={cancelledRides.length} /> <span className="text-sm text-slate-400 font-bold">cancelled</span></p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-blue-50 text-blue-500 rounded-xl border border-blue-100"><CircleDollarSign size={18} /></div>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Average Fare</p>
                  <p className="text-2xl font-black text-emerald-600"><AnimatedNumber value={parseFloat(avgFare)} decimals={2} prefix="$" /></p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl border border-indigo-100"><UserCheck size={18} /></div>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Total Passengers</p>
                  <p className="text-2xl font-black text-slate-800"><AnimatedNumber value={totalPax} /> <span className="text-sm text-slate-400 font-bold">pax</span></p>
                </motion.div>
              </div>

              {/* ROW 2: FINANCIAL SUMMARY */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Revenue (Locked)</p>
                      <h3 className="text-3xl font-black text-slate-800 mt-1">
                        $<AnimatedNumber value={invoicedRevenue} decimals={2} />
                      </h3>
                    </div>
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><ShieldCheck size={24} /></div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${collectionRate}%` }} transition={{ duration: 1.2, ease: "easeOut" }} className="bg-emerald-500 h-full" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">{collectionRate}% Collected</p>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-2xl shadow-lg shadow-blue-200">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-2">Monthly Statement</h3>
                  <p className="text-blue-100 text-sm font-medium mb-6">Download the official finalized manifest for accounting.</p>
                  <button onClick={downloadMonthlyReport} className="w-full py-3 bg-white text-blue-700 font-black uppercase text-xs rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                    <Download size={16} /> Export CSV
                  </button>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fleet Health</p>
                      <h3 className="text-3xl font-black text-slate-800 mt-1">
                        <AnimatedNumber value={activeVehiclesCount} />
                        <span className="text-sm opacity-50 ml-1">/ {vehicles.length} Active</span>
                      </h3>
                    </div>
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><Truck size={24} /></div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {vehicles.map((v, i) => (
                      <div key={v._id || i} className={`w-4 h-4 rounded-full border-2 ${v.status === "Active" ? "bg-emerald-400 border-emerald-200" : "bg-slate-300 border-slate-200"}`} title={`${v.name}: ${v.status}`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ROW 3: CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PEAK HOURS CHART */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[400px]">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <BarChart3 size={16} className="text-blue-500" /> Peak Traffic Hours
                  </h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={hourlyFleetUsage.map((count, hour) => ({ hour: `${hour}:00`, rides: count })).filter((d) => d.rides > 0)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="hour" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                      <Bar dataKey="rides" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* RIDE STATUS DISTRIBUTION (Pie Chart) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[400px]">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <PieChart size={16} className="text-purple-500" /> Ride Status Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <RePie>
                      <Pie data={statusDistribution} cx="50%" cy="45%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {statusDistribution.map((entry, i) => (<Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                      <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 700 }} />
                    </RePie>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ROW 4: WEEKLY TREND + RIDER DEMOGRAPHICS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 7-DAY TREND */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[350px]">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Activity size={16} className="text-emerald-500" /> 7-Day Ride Trend
                  </h3>
                  <ResponsiveContainer width="100%" height="82%">
                    <BarChart data={last7Days}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} fontWeight={700} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                      <Bar dataKey="rides" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* RIDER DEMOGRAPHICS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[350px]">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <UserCheck size={16} className="text-indigo-500" /> Rider Demographics
                  </h3>
                  <ResponsiveContainer width="100%" height="82%">
                    <RePie>
                      <Pie data={riderDistribution} cx="50%" cy="45%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {riderDistribution.map((entry, i) => (<Cell key={i} fill={RIDER_COLORS[i % RIDER_COLORS.length]} />))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                      <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 700 }} />
                    </RePie>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ROW 5: DRIVER PERFORMANCE + TOP ROUTES */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* DRIVER UTILIZATION */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Truck size={16} className="text-blue-500" /> Driver Utilization
                  </h3>
                  {driverPerformance.length > 0 ? (
                    <div className="space-y-4">
                      {driverPerformance.map((dp, i) => {
                        const maxRides = driverPerformance[0]?.rides || 1;
                        const pct = ((dp.rides / maxRides) * 100).toFixed(0);
                        return (
                          <div key={dp.name} className="flex items-center gap-4">
                            <div className="flex items-center gap-2.5 w-32 shrink-0">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-black ${i === 0 ? "bg-blue-600" : i === 1 ? "bg-blue-400" : "bg-slate-400"}`}>
                                #{i + 1}
                              </div>
                              <span className="text-xs font-black text-slate-700 truncate">{dp.name}</span>
                            </div>
                            <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }} className={`h-full rounded-full ${i === 0 ? "bg-blue-500" : i === 1 ? "bg-blue-400" : "bg-slate-400"}`} />
                            </div>
                            <span className="text-xs font-black text-slate-600 w-16 text-right">{dp.rides} rides</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest text-center py-8">No driver assignments yet</p>
                  )}
                </div>

                {/* TOP ROUTES */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <MapPin size={16} className="text-red-500" /> Top Routes
                  </h3>
                  {topRoutes.length > 0 ? (
                    <div className="space-y-3">
                      {topRoutes.map(([route, count], i) => (
                        <div key={route} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black ${i === 0 ? "bg-red-500" : i === 1 ? "bg-orange-500" : "bg-slate-400"}`}>
                              {i + 1}
                            </span>
                            <span className="text-[11px] font-bold text-slate-600 truncate max-w-[250px]">{route}</span>
                          </div>
                          <span className="text-xs font-black text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">{count} trips</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest text-center py-8">No route data available</p>
                  )}
                </div>
              </div>

              {/* ROW 6: OPS SNAPSHOT */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ACTIVE RIDERS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <UserCheck size={16} className="text-blue-500" /> Active Riders ({opsSnapshot.riders.length})
                  </h3>
                  {opsSnapshot.riders.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {opsSnapshot.riders.map((rider, i) => (
                        <div key={rider._id || i} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-black text-[10px]">{(rider.username || rider.fullName || "?").charAt(0).toUpperCase()}</div>
                          <span className="font-bold text-slate-700 truncate">{rider.username || rider.fullName || `Rider #${i + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs font-bold uppercase text-center py-6">No active riders</p>
                  )}
                </div>

                {/* ACTIVE DRIVERS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Truck size={16} className="text-indigo-500" /> Active Drivers ({opsSnapshot.drivers.length})
                  </h3>
                  {opsSnapshot.drivers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {opsSnapshot.drivers.map((driver, i) => {
                        const assignedVehicle = vehicles.find(v => v.assignedDriver === driver.username);
                        return (
                          <div key={driver._id || i} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-[10px]">{(driver.username || "?").charAt(0).toUpperCase()}</div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-700 truncate">{driver.username || `Driver #${i + 1}`}</span>
                              {assignedVehicle && <span className="text-[9px] text-blue-500 font-bold truncate">{assignedVehicle.name}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs font-bold uppercase text-center py-6">No active drivers</p>
                  )}
                </div>
              </div>

              {/* AUDIT LOG */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                    <FileText size={20} className="text-slate-400" /> System Audit Trail
                  </h3>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">Read-Only</span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        <th className="p-4">Time</th>
                        <th className="p-4">User</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Target</th>
                        <th className="p-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {auditLogs.slice(0, 15).map((log) => (
                        <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-mono text-slate-500 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                          <td className="p-4 font-bold text-slate-700">{log.performedBy}</td>
                          <td className="p-4">
                            <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold uppercase text-slate-600">{log.action}</span>
                          </td>
                          <td className="p-4 text-xs font-mono text-slate-400">{log.targetModel}</td>
                          <td className="p-4 text-slate-600 text-xs cursor-default">
                            {(() => {
                              if (log.metadata && typeof log.metadata === "string") return log.metadata;
                              if (!log.changes && !log.metadata) return "-";
                              const data = log.changes || log.metadata;
                              if (data && data.from && data.to) {
                                return (
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-400 line-through">{data.from}</span>
                                    <span className="text-slate-300">→</span>
                                    <span className="font-black text-emerald-600">{data.to}</span>
                                  </div>
                                );
                              }
                              let str = typeof data === "object" ? JSON.stringify(data) : data;
                              const cleanStr = str.replace(/[{}""]/g, "").replace(/:/g, ": ").replace(/,/g, ", ");
                              return (<div className="truncate max-w-[200px]" title={str}>{cleanStr}</div>);
                            })()}
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">No audit records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-800">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  System Hardened & Audit-Ready v1.0
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* EDIT MODAL */}
      {editingRide && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Pencil size={16} className="text-amber-500" /> Edit Ride
                Details
              </h3>
              <button
                onClick={() => setEditingRide(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Scheduled Time
                </label>
                <input
                  type="datetime-local"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue={dayjs(editingRide.scheduledTime).format(
                    "YYYY-MM-DDTHH:mm",
                  )} // formatting for input
                  id="edit-time"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Override Fare ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500 text-emerald-600"
                  defaultValue={editingRide.fare}
                  id="edit-fare"
                />
              </div>

              <button
                onClick={async () => {
                  const newTime = document.getElementById("edit-time").value;
                  const newFare = document.getElementById("edit-fare").value;
                  if (!newTime || newFare === "")
                    return alert("Fields cannot be empty");

                  try {
                    await updateRideDetails(editingRide._id, {
                      scheduledTime: newTime,
                      fare: parseFloat(newFare),
                    });
                    setEditingRide(null);
                    setEditingRide(null);
                    fetchData(); // Refresh
                    addToast("Details Updated", "success");
                  } catch (e) {
                    addToast("Update Failed", "error");
                  }
                }}
                className="w-full py-3 bg-blue-900 text-white font-black rounded-xl uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING MODAL */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 border-t-8 border-emerald-500 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Phone size={24} className="text-emerald-500" /> Manual Phone
                Booking
              </h3>
              <button
                onClick={() => setIsBookingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleManualBooking} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Passenger Name
                  </label>
                  <input
                    name="passengerName"
                    required
                    type="text"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Phone Number
                  </label>
                  <input
                    name="phoneNumber"
                    required
                    type="text"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. 555-0199"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Pickup Address
                  </label>
                  <input
                    name="pickup"
                    required
                    type="text"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Include House #"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Dropoff Address
                  </label>
                  <input
                    name="dropoff"
                    required
                    type="text"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Include House #"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Date & Time
                  </label>
                  <input
                    name="scheduledTime"
                    required
                    type="datetime-local"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Group Size
                  </label>
                  <input
                    name="passengers"
                    required
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Passenger Type (Fare Calc)
                </label>
                <select
                  name="userType"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="General">General Public</option>
                  <option value="Elderly/Disabled">Elderly / Disabled</option>
                  <option value="Child">Child</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
              >
                <Plus size={18} /> Confirm Manual Booking
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FLEET ASSIGNMENT MODAL */}
      {activeTab === "assignments" && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                  <Truck size={24} className="text-blue-600" /> Fleet
                  Assignments
                </h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                  Manage Driver Schedules
                </p>
              </div>
              <button
                onClick={() => setActiveTab("manifest")}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-2">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle._id}
                  className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-200"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-xl ${vehicle.status === "Active" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}
                    >
                      <Truck size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-700">
                        {vehicle.name}
                      </h4>
                      <p className="text-xs font-bold text-slate-400 uppercase">
                        {vehicle.type} • {vehicle.capacity} Seats
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Assigned Driver
                      </p>
                      <div className="relative">
                        <select
                          value={vehicle.assignedDriver || ""}
                          onChange={async (e) => {
                            const newDriver = e.target.value;
                            try {
                              await updateVehicleDriver(vehicle._id, newDriver);
                              fetchData(); // Refresh list
                              addToast(
                                `Assigned ${newDriver || "No One"} to ${vehicle.name}`,
                                "success",
                              );
                            } catch (err) {
                              addToast("Assignment Failed", "error");
                            }
                          }}
                          className="appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-sm py-2 pl-4 pr-10 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-blue-300 transition-colors"
                        >
                          <option value="">-- Unassigned --</option>
                          {driversList.map((d) => (
                            <option key={d._id} value={d.username}>
                              {d.username}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <UserCheck size={14} />
                        </div>
                      </div>
                    </div>

                    {/* Status Toggle (Bonus: Quick Maintenance Toggle) */}
                    {/* <button className="p-2 text-slate-300 hover:text-amber-500 transition-colors" title="Maintenance Mode"><Settings size={18} /></button> */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER QUICK LINKS - MODIFIED */}
      <div className="mt-12 pt-6 border-t border-slate-200 flex justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <button
          onClick={() => setActiveTab("assignments")}
          className="hover:text-blue-500 transition-colors flex items-center gap-2"
        >
          <UserCheck size={14} /> Manage Drivers
        </button>
        <a
          href="/fleet"
          target="_blank"
          className="hover:text-blue-500 transition-colors flex items-center gap-2"
        >
          <Truck size={14} /> Fleet Manager
        </a>
      </div>

      {/* TOAST NOTIFICATIONS CONTAINER */}
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
      {confirmAction && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmAction(null)}
          ></div>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative z-10 animate-in fade-in zoom-in">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
              <ShieldAlert className="text-amber-500" /> Confirm Action
            </h3>
            <p className="text-slate-600 font-bold text-sm mb-6">
              {confirmAction.message}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors uppercase tracking-widest text-xs"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors uppercase tracking-widest text-xs"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRIVER CHAT MODAL ─────────────────────────────────── */}
      {chatModal && (
        <div className="fixed inset-0 bg-black/50 z-[130] flex items-end sm:items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col" style={{ height: 480 }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-slate-800 rounded-t-2xl text-white">
              <div>
                <p className="font-black text-sm uppercase tracking-widest">Driver Chat</p>
                <p className="text-slate-300 text-xs font-bold">{chatModal.driverName}</p>
              </div>
              <button onClick={closeChat} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <XCircle size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
              {chatMessages.length === 0 && (
                <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest pt-8">
                  Send a message to {chatModal.driverName}
                </p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.from === "Dispatcher" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${m.from === "Dispatcher" ? "bg-blue-900 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>
                    <p className="font-medium">{m.text}</p>
                    <p className="text-[10px] opacity-60 mt-0.5">{m.ts}</p>
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2 p-3 border-t border-slate-100">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="Message driver..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
              />
              <button
                onClick={sendChatMessage}
                className="p-2.5 bg-blue-900 text-white rounded-xl hover:bg-blue-800 transition-colors"
              >
                <Phone size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT DRIVER MODAL ─────────────────────────────────── */}
      {editDriverModal && (
        <div className="fixed inset-0 bg-black/50 z-[130] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Pencil size={16} className="text-amber-500" /> Edit Driver
              </h3>
              <button onClick={() => setEditDriverModal(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: "Full Name", field: "fullName", type: "text" },
                { label: "Phone Number", field: "phoneNumber", type: "text" },
                { label: "License #", field: "licenseNumber", type: "text" },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{label}</label>
                  <input
                    type={type}
                    value={editDriverModal[field] || ""}
                    onChange={(e) => setEditDriverModal((prev) => ({ ...prev, [field]: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <button
                onClick={saveEditDriver}
                disabled={editDriverLoading}
                className="w-full py-3 bg-blue-900 text-white font-black rounded-xl uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {editDriverLoading ? "Saving..." : <><CheckCircle size={18} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatcherDashboard;
