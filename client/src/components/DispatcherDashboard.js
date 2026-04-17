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

  const fetchData = async () => {
    try {
      const [
        ridesData,
        vehiclesData,
        autoAcceptData,
        auditLogsData,
        driversData,
      ] = await Promise.all([
        getRides(),
        getVehicles(),
        getAutoAccept(),
        getAuditLogs(),
        getDrivers(),
      ]);
      setRides(ridesData);
      setVehicles(vehiclesData);
      setAutoAccept(autoAcceptData.autoAccept);
      setAuditLogs(auditLogsData || []);
      setDriversList(driversData || []);
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
    <div className="max-w-5xl mx-auto space-y-6 pb-20 font-sans">
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
      <div
        className={`flex flex-col md:flex-row justify-between items-center bg-white/80 backdrop-blur-xl p-4 rounded-3xl shadow-xl border border-white/20 gap-4 mt-6`}
      >
        {/* AUTO-ACCEPT TOGGLE & DATE NAV */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-2xl">
            <button
              onClick={() => {
                setViewDate(
                  dayjs(viewDate).subtract(1, "day").format("YYYY-MM-DD"),
                );
              }}
              className="p-2 hover:bg-white rounded-xl transition-all shadow-sm text-slate-500 hover:text-blue-600"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex flex-col items-center px-4">
              <input
                type="date"
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="font-black text-sm outline-none bg-transparent cursor-pointer text-slate-700"
              />
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider">
                {new Date(viewDate + "T12:00:00").toLocaleDateString(
                  undefined,
                  { weekday: "long" },
                )}
              </span>
            </div>

            <button
              onClick={() => {
                setViewDate(dayjs(viewDate).add(1, "day").format("YYYY-MM-DD"));
              }}
              className="p-2 hover:bg-white rounded-xl transition-all shadow-sm text-slate-500 hover:text-blue-600"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* SETTINGS TOGGLE */}
          <button
            onClick={async () => {
              const newState = !autoAccept;
              setAutoAccept(newState);
              await updateAutoAccept(newState);
              addToast(
                `Auto-Accept ${newState ? "Enabled" : "Disabled"}`,
                "success",
              );
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-widest ${autoAccept ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-400"}`}
          >
            <Settings
              size={14}
              className={autoAccept ? "animate-spin-slow" : ""}
            />
            {autoAccept ? "Auto-Confirm ON" : "Manual Review"}
          </button>
        </div>

        {/* VIEW TABS */}
        <div className="flex p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab("manifest")}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === "manifest" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            Manifest
          </button>
          <button
            onClick={() => setActiveTab("map")}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === "map" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            <Map size={14} /> Live Map
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === "reports" ? "bg-white text-purple-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            <BarChart3 size={14} /> Reports
          </button>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right hidden lg:block">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Revenue
            </p>
            <p className="text-2xl font-black text-emerald-600 tracking-tight">
              <AnimatedNumber value={dailyRevenue} decimals={2} prefix="$" />
            </p>
          </div>

          {/* EXPERT FIX: Active Fleet Math (Total - In Shop) */}
          <div className="text-right hidden lg:block">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Active Fleet
            </p>
            <p
              className={`text-2xl font-black tracking-tight ${activeVehiclesCount < vehicles.length ? "text-amber-600" : "text-blue-900"}`}
            >
              <AnimatedNumber value={activeVehiclesCount} />{" "}
              <span className="text-sm text-slate-400 font-bold">
                / {vehicles.length || 7}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* NEW BOOKING BUTTON */}
          <button
            onClick={() => setIsBookingModalOpen(true)}
            className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all font-black hover:scale-105 active:scale-95"
          >
            <Plus size={20} />
          </button>

          {/* CSV EXPORT BUTTON */}
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
            className="p-4 bg-blue-900 text-white rounded-2xl shadow-lg hover:bg-blue-800 transition-all font-black hover:scale-105 active:scale-95"
          >
            <UserCheck size={20} />
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
          <div className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/40">
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
                      // On first load → cards rise gently from below (subtle, not distracting).
                      // After first load → new cards pushed by socket slide in from the right.
                      initial={
                        isFirstLoad.current
                          ? { opacity: 0, scale: 0.95, y: 10 }
                          : { opacity: 0, x: 60 }
                      }
                      animate={{
                        opacity: 1,
                        x: 0,
                        scale: 1,
                        y: 0,
                        // Gold glow pulse when this specific card was just updated via socket.
                        // Spreads outward then fades over 2 seconds, then returns to invisible.
                        ...(recentlyUpdatedId === ride._id
                          ? {
                              boxShadow: [
                                "0 0 0 0px rgba(251, 191, 36, 0)",
                                "0 0 0 4px rgba(251, 191, 36, 0.9)",
                                "0 0 0 8px rgba(251, 191, 36, 0.3)",
                                "0 0 0 0px rgba(251, 191, 36, 0)",
                              ],
                            }
                          : {
                              boxShadow: "0 0 0 0px rgba(251, 191, 36, 0)",
                            }),
                      }}
                      exit={{ opacity: 0, x: -30, scale: 0.95 }}
                      transition={{
                        duration: 0.35,
                        delay: isFirstLoad.current ? index * 0.04 : 0,
                        ease: [0.22, 1, 0.36, 1],
                        ...(recentlyUpdatedId === ride._id && {
                          boxShadow: {
                            duration: 2,
                            ease: "easeOut",
                            times: [0, 0.25, 0.6, 1],
                          },
                        }),
                      }}
                      className={`bg-white/80 backdrop-blur-md p-5 rounded-2xl border-l-4 border-t border-r border-b transition-all flex flex-col lg:flex-row justify-between items-center gap-4 shadow-sm hover:shadow-xl hover:bg-white hover:scale-[1.01] group
                                    ${
                                      ride.status === "Confirmed"
                                        ? "border-l-emerald-500 border-white"
                                        : ride.status === "En-Route"
                                          ? "border-l-blue-500 border-blue-100 bg-blue-50/10"
                                          : ride.status === "Rejected"
                                            ? "border-l-red-500 border-red-100 bg-red-50/10"
                                            : ride.status === "Completed"
                                              ? "border-l-teal-500 border-teal-100"
                                              : "border-l-amber-400 border-white"
                                    }
                                    ${isOverbooked ? "ring-2 ring-red-500 ring-offset-2" : ""}`}
                    >
                      <div className="flex-1 space-y-2 w-full">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[10px] font-black bg-slate-800 text-white px-2 py-1 rounded flex items-center gap-1 shadow-md">
                            <Ticket size={10} />{" "}
                            {ride.ticketId || `TKT-${index + 100}`}
                          </span>
                          <h4 className="font-bold text-slate-800 text-lg tracking-tight">
                            {ride.passengerName}
                          </h4>
                          <span
                            className={`text-[9px] font-black px-3 py-1 rounded-full uppercase shadow-sm ${
                              ride.status === "Confirmed"
                                ? "bg-emerald-100 text-emerald-700"
                                : ride.status === "En-Route"
                                  ? "bg-blue-100 text-blue-700 animate-pulse"
                                  : ride.status === "Completed"
                                    ? "bg-green-100 text-green-700 border border-green-200"
                                    : ride.status === "Rejected"
                                      ? "bg-slate-100 text-slate-400"
                                      : ride.status === "Pending" ||
                                          ride.status === "Pending Review"
                                        ? "bg-amber-100 text-amber-700 animate-pulse"
                                        : "bg-amber-100 text-amber-700"
                            } `}
                          >
                            {ride.status}
                          </span>
                          {isElderly && (
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 shadow-md shadow-blue-200">
                              <UserCheck size={10} /> PRIORITY
                            </div>
                          )}
                          {isOverbooked && (
                            <div className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[8px] font-bold animate-bounce flex items-center gap-1">
                              <ShieldAlert size={10} /> FLEET FULL
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 grid grid-cols-1 md:grid-cols-3 gap-4 pl-1">
                          <p className="flex items-center gap-2 font-medium">
                            <Phone size={14} className="text-slate-300" />{" "}
                            {ride.phoneNumber}
                          </p>
                          <p className="flex items-center gap-2 font-bold text-slate-700">
                            <Clock size={14} className="text-blue-500" />{" "}
                            {d.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="flex items-center gap-2 text-blue-600 font-bold truncate bg-blue-50/50 px-3 py-1 rounded-lg border border-blue-100/50">
                            <MapPin size={12} className="text-red-400" />{" "}
                            {ride.pickup} → {ride.dropoff}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-between border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-6 border-slate-100">
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          {/* Assigned Driver Display */}
                          <div className="relative">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                              Assigned Vehicle
                            </p>
                            <select
                              value={ride.assignedVehicle || "Unassigned"}
                              onChange={(e) =>
                                handleVehicleAssign(ride._id, e.target.value)
                              }
                              className="w-full text-[10px] font-bold border border-slate-200 rounded-xl p-2.5 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                            >
                              <option value="Unassigned">
                                -- Select Asset --
                              </option>
                              {vehicles.length > 0 ? (
                                vehicles.map((v) => (
                                  <option key={v._id} value={v.name}>
                                    {v.name} ({v.type})
                                  </option>
                                ))
                              ) : (
                                <>
                                  <option value="Large Van (5)">
                                    Large Van (5)
                                  </option>
                                  <option value="Small Car (2)">
                                    Small Car (2)
                                  </option>
                                </>
                              )}
                            </select>

                            {/* SHOW DRIVER IF ASSIGNED */}
                            {(() => {
                              const v = vehicles.find(
                                (veh) => veh.name === ride.assignedVehicle,
                              );
                              if (v && v.assignedDriver) {
                                return (
                                  <div className="absolute -bottom-6 left-0 flex items-center gap-1.5 text-[10px] font-black text-white bg-blue-600 px-3 py-1 rounded-full shadow-md z-10 animate-in fade-in slide-in-from-bottom-2">
                                    <UserCheck size={12} /> {v.assignedDriver}
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <Truck size={12} />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {/* SMART MAP BUTTON */}
                          <button
                            onClick={() => {
                              const origin = encodeURIComponent(
                                ride.pickup + ", Ashland, OH",
                              );
                              const dest = encodeURIComponent(
                                ride.dropoff + ", Ashland, OH",
                              );
                              window.open(
                                `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`,
                                "_blank",
                              );
                            }}
                            className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all hover:scale-110 active:scale-90"
                            title="Open Smart Map"
                          >
                            <MapPin size={16} />
                          </button>

                          {/* CHAT WITH DRIVER BUTTON */}
                          {(() => {
                            const v = vehicles.find((veh) => veh.name === ride.assignedVehicle);
                            if (!v?.assignedDriver) return null;
                            const driver = driversList.find((d) => d.username === v.assignedDriver);
                            return (
                              <button
                                onClick={() => openChat(v.assignedDriver, driver?._id || v.assignedDriver)}
                                className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-90"
                                title="Chat with Driver"
                              >
                                <Phone size={16} />
                              </button>
                            );
                          })()}

                          {/* EDIT BUTTON */}
                          <button
                            onClick={() => setEditingRide(ride)}
                            className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all hover:scale-110 active:scale-90"
                            title="Edit Manual Details"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() =>
                              handleStatusUpdate(
                                ride._id,
                                "Confirmed",
                                ride.scheduledTime,
                              )
                            }
                            className="p-2.5 bg-emerald-500 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 hover:scale-110 active:scale-95 transition-all"
                            title="Confirm Ride"
                          >
                            <CheckCircle size={16} />
                          </button>

                          {/* EMERGENCY CANCEL */}
                          {ride.status === "Confirmed" ||
                          ride.status === "En-Route" ? (
                            <button
                              onClick={() =>
                                handleStatusUpdate(ride._id, "Cancelled")
                              }
                              className="p-2.5 bg-red-100 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm hover:scale-110 active:scale-90"
                              title="Emergency Cancel"
                            >
                              <Ban size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleStatusUpdate(ride._id, "Rejected")
                              }
                              className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm hover:scale-110 active:scale-90"
                              title="Reject Request"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>

                        <div className="text-right min-w-[70px]">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            {ride.passengers} Pax
                          </p>
                          <div className="flex flex-col items-end">
                            <p className="text-xl font-black text-slate-800 tracking-tight">
                              ${ride.fare.toFixed(2)}
                            </p>
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CircleDollarSign size={8} /> VERIFIED
                            </span>
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
        <div className="space-y-8 animate-in fade-in">
          {/* 1. FINANCIAL SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Revenue (Locked)
                  </p>
                  <h3 className="text-3xl font-black text-slate-800 mt-1">
                    $
                    {rides
                      .reduce(
                        (acc, r) =>
                          acc +
                          (r.paymentStatus === "Invoiced"
                            ? r.finalizedFare || r.fare
                            : 0),
                        0,
                      )
                      .toFixed(2)}
                  </h3>
                </div>
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                  <ShieldCheck size={24} />
                </div>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[75%]"></div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">
                75% Collected
              </p>
            </div>

            <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-lg shadow-blue-200">
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">
                Monthly Statement
              </h3>
              <p className="text-blue-100 text-sm font-medium mb-6">
                Download the official finalized manifest for accounting.
              </p>
              <button
                onClick={downloadMonthlyReport}
                className="w-full py-3 bg-white text-blue-700 font-black uppercase text-xs rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
            {/* FLEET HEALTH CARD */}
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 flex items-center gap-6">
              <div className="p-4 bg-amber-100 rounded-2xl text-amber-600">
                <Truck size={32} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Fleet Health
                </p>
                <h3 className="text-3xl font-black text-slate-800">
                  {activeVehiclesCount}{" "}
                  <span className="text-sm opacity-50">
                    / {vehicles.length} Active
                  </span>
                </h3>
              </div>
            </div>
          </div>

          {/* CHARTS CONTAINER */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PEAK HOURS CHART */}
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 h-[400px]">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">
                Peak Traffic Hours
              </h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart
                  data={hourlyFleetUsage
                    .map((count, hour) => ({
                      hour: `${hour}:00`,
                      rides: count,
                    }))
                    .filter((d) => d.rides > 0)}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    dataKey="hour"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "#F1F5F9" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar
                    dataKey="rides"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. IMMUTABLE AUDIT LOG */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <FileText size={20} className="text-slate-400" /> System Audit
                Trail
              </h3>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">
                Read-Only
              </span>
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
                    <tr
                      key={log._id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4 font-mono text-slate-500 text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4 font-bold text-slate-700">
                        {log.performedBy}
                      </td>
                      <td className="p-4">
                        <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold uppercase text-slate-600">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-mono text-slate-400">
                        {log.targetModel}
                      </td>
                      <td
                        className="p-4 text-slate-600 text-xs max-w-xs truncate"
                        title={JSON.stringify(log.changes || log.metadata)}
                      >
                        {log.metadata ||
                          (log.changes ? JSON.stringify(log.changes) : "-")}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="p-8 text-center text-slate-400 italic"
                      >
                        No audit records found.
                      </td>
                    </tr>
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
