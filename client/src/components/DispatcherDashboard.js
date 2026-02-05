import React, { useState, useEffect, useMemo } from 'react';
import LeafletMap from './LeafletMap'; // Ensure Map is imported
import { getRides, updateRideStatus, updateRideVehicle, getVehicles, updateRideDetails, createRide } from '../services/api'; // Added updateRideDetails, createRide
import { Clock, MapPin, CheckCircle, XCircle, Phone, Search, Truck, ShieldAlert, ChevronLeft, ChevronRight, UserCheck, Ticket, CircleDollarSign, Ban, Pencil, Plus } from 'lucide-react'; // Added Ban, Pencil, Plus
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { AnimatePresence, motion } from 'framer-motion';
import Toast from './Toast';

const { generateMockDrivers, moveDrivers, calculateETA } = require('../services/mockDriverService'); // Import Mock Services

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const DispatcherDashboard = () => {
    const [rides, setRides] = useState([]);
    const [vehicles, setVehicles] = useState([]); // Dynamic Fleet
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [editingRide, setEditingRide] = useState(null); // Fix: Added State
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false); // NEW STATE
    const [toasts, setToasts] = useState([]);
    // Confirmation State
    const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // EXPERT DATE MATCHER: Prevents the "Empty Graph" by ignoring UTC offsets
    const [viewDate, setViewDate] = useState(dayjs().format('YYYY-MM-DD'));

    const fetchData = async () => {
        try {
            const [ridesData, vehiclesData] = await Promise.all([getRides(), getVehicles()]);
            setRides(ridesData);
            setVehicles(vehiclesData);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // POLL: Keep manifest updated every 10 seconds
        const interval = setInterval(() => {
            fetchData();
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    // NEW: Handle Manual Booking
    const handleManualBooking = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const rideData = {
            passengerName: formData.get('passengerName'),
            phoneNumber: formData.get('phoneNumber'),
            pickup: formData.get('pickup'),
            pickupDetails: formData.get('pickupDetails'), // Capture specific notes
            dropoff: formData.get('dropoff'),
            scheduledTime: formData.get('scheduledTime'),
            userType: formData.get('userType'),
            passengers: parseInt(formData.get('passengers')),
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
            addToast("Booking Created Successfully", 'success');
        } catch (error) {
            addToast("Error creating booking: " + error.message, 'error');
        }
    };

    // --- EXPERT ENGINE: LOCALIZED SYNC & PRIORITY SORTING ---
    const processedData = useMemo(() => {
        const stats = Array(24).fill(0);

        // Calculate Active Fleet Capacity (Total - In Shop)
        const activeVehiclesCount = vehicles.filter(v => v.status === 'Active').length || 7; // Fallback to 7 if loading

        const filtered = rides
            .filter(ride => {
                // STRICT DATE HANDSHAKE using dayjs
                const rideDate = dayjs(ride.scheduledTime).format('YYYY-MM-DD');
                const isDateMatch = rideDate === viewDate;

                const matchesSearch = ride.passengerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    ride.phoneNumber.includes(searchTerm);

                return isDateMatch && matchesSearch;
            })
            // PRIORITY SORTING: Elderly first, then by booking sequence (First-Come First-Served)
            .sort((a, b) => {
                if (a.userType === 'Elderly/Disabled' && b.userType !== 'Elderly/Disabled') return -1;
                if (a.userType !== 'Elderly/Disabled' && b.userType === 'Elderly/Disabled') return 1;
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

        // GHOST GRAPH FIX: Iterate the ALREADY FILTERED list to build stats
        // We trust 'filtered' only contains rides for 'viewDate', so we just grab the hour.
        filtered.forEach(ride => {
            if (ride.status === 'Confirmed' || ride.status === 'En-Route') {
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
                addToast(`Ride ${newStatus}`, 'success');
            } catch (e) {
                addToast("Update Failed", 'error');
            }
        };

        if (newStatus === 'Confirmed') {
            const hour = dayjs(rideTime).hour();
            const currentConfirmedInHour = hourlyFleetUsage[hour] || 0;
            if (currentConfirmedInHour >= activeVehiclesCount) {
                setConfirmAction({
                    message: `⚠️ OVERBOOKING WARNING: This hour is already full (${currentConfirmedInHour}/${activeVehiclesCount}). Force confirm anyway?`,
                    onConfirm: () => {
                        update();
                        setConfirmAction(null);
                    }
                });
                return;
            }
        }

        // CANCELLATION CHECK
        if (newStatus === 'Cancelled') {
            setConfirmAction({
                message: "EMERGENCY CANCEL: This will immediately free up fleet capacity. Proceed?",
                onConfirm: () => {
                    update();
                    setConfirmAction(null);
                }
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
            addToast("Vehicle Assigned", 'success');
        } catch (e) {
            addToast("Assignment Failed", 'error');
        }
    };

    const peakUsage = Math.max(...hourlyFleetUsage);
    const dailyRevenue = processedData.filtered.reduce((acc, r) => r.status === 'Confirmed' || r.status === 'Completed' ? acc + r.fare : acc, 0);

    // MOCK DRIVER SIMULATION
    // ------------------------------------------------------------
    const [mockVehicles, setMockVehicles] = useState([]);

    // Import helper (assuming you imported it at the top)
    // import { generateMockDrivers, moveDrivers, calculateETA } from '../services/mockDriverService';

    useEffect(() => {
        // Initial Mock Data
        let currentDrivers = generateMockDrivers();
        setMockVehicles(currentDrivers);

        const driveInterval = setInterval(() => {
            currentDrivers = moveDrivers(currentDrivers);
            setMockVehicles([...currentDrivers]); // trigger render
        }, 1000); // Update every second for smooth animation

        return () => clearInterval(driveInterval);
    }, []);

    // Helper to get ETA for a specific ride
    const getETA = (ride) => {
        // For POC, just find the closest vehicle or assign a random one
        // In reality, you'd match "ride.assignedVehicle" to the mock vehicle ID
        const vehicle = mockVehicles[0]; // Just picking first for demo if unassigned
        if (!vehicle) return "N/A";

        // We need coordinates for the ride. 
        // In a real app we'd geocode "ride.pickup". 
        // For this POC, we'll assume a fixed central point for unknown addresses or random variation
        // Or better: Just use a fixed "Distance" for the demo if we can't geocode

        // Let's sim it: If status is En-Route, show real-ish countdown
        if (ride.status === 'En-Route') {
            // Mock destination coords (Ashland center + offset based on ticketId hash maybe?)
            // Simple hash for consistency
            const lat = 40.8688 + (ride.ticketId?.length || 0) * 0.001;
            const lng = -82.3179 - (ride.ticketId?.length || 0) * 0.001;
            return calculateETA(vehicle.lat, vehicle.lng, lat, lng) + " min";
        }
        return "15 min"; // Standard promise time
    };
    // ------------------------------------------------------------

    if (loading) return <div className="p-10 text-center font-bold text-blue-600 animate-pulse tracking-widest uppercase">Syncing Manifest...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 font-sans">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN: MANIFEST (Takes up 2/3 on desktop) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* CRITICAL OVERBOOK ALERT - FIXED TOP */}
                    {
                        peakUsage > activeVehiclesCount && (
                            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce">
                                <ShieldAlert size={32} className="text-white" />
                                <div>
                                    <h2 className="text-lg font-black uppercase tracking-widest">Critial Overbooking</h2>
                                    <p className="font-bold text-xs opacity-90">{peakUsage} rides exceed fleet capacity of {activeVehiclesCount}.</p>
                                </div>
                            </div>
                        )
                    }

                    {/* COMPACT DASHBOARD HEADER */}
                    <div className={`flex flex-col md:flex-row justify-between items-center bg-white/80 backdrop-blur-xl p-4 rounded-3xl shadow-xl border border-white/20 gap-4 mt-6`}>
                        <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-2xl">
                            <button onClick={() => {
                                setViewDate(dayjs(viewDate).subtract(1, 'day').format('YYYY-MM-DD'));
                            }} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm text-slate-500 hover:text-blue-600"><ChevronLeft size={20} /></button>

                            <div className="flex flex-col items-center px-6">
                                <input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} className="font-black text-sm outline-none bg-transparent cursor-pointer text-slate-700" />
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider">{new Date(viewDate + "T12:00:00").toLocaleDateString(undefined, { weekday: 'long' })}</span>
                            </div>

                            <button onClick={() => {
                                setViewDate(dayjs(viewDate).add(1, 'day').format('YYYY-MM-DD'));
                            }} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm text-slate-500 hover:text-blue-600"><ChevronRight size={20} /></button>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="text-right">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Revenue</p>
                                <p className="text-2xl font-black text-emerald-600 tracking-tight">${dailyRevenue.toFixed(2)}</p>
                            </div>

                            {/* EXPERT FIX: Active Fleet Math (Total - In Shop) */}
                            <div className="text-right">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Fleet</p>
                                <p className={`text-2xl font-black tracking-tight ${activeVehiclesCount < vehicles.length ? 'text-amber-600' : 'text-blue-900'}`}>
                                    {activeVehiclesCount} <span className="text-sm text-slate-400 font-bold">/ {vehicles.length || 7}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* NEW BOOKING BUTTON */}
                            <button onClick={() => setIsBookingModalOpen(true)} className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all font-black hover:scale-105 active:scale-95">
                                <Plus size={20} />
                            </button>

                            {/* CSV EXPORT BUTTON */}
                            <button onClick={() => {
                                const headers = ["TicketID", "Passenger", "Status", "Pickup", "Dropoff", "Time (CA-EN)", "Vehicle", "Fare"];
                                const csvRows = processedData.filtered.map(r => [
                                    r.ticketId || "N/A",
                                    `"${r.passengerName}"`,
                                    r.status,
                                    `"${r.pickup}"`,
                                    `"${r.dropoff}"`,
                                    new Date(r.scheduledTime).toLocaleString('en-CA'),
                                    r.assignedVehicle || "Unassigned",
                                    r.fare.toFixed(2)
                                ].join(","));

                                const totalRevenue = processedData.filtered
                                    .filter(r => r.status === 'Confirmed' || r.status === 'Completed')
                                    .reduce((sum, r) => sum + r.fare, 0);

                                csvRows.push(`,,,,,,TOTAL REVENUE,$${totalRevenue.toFixed(2)}`);

                                const csvContent = [headers.join(","), ...csvRows].join("\n");
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement("a");
                                link.href = URL.createObjectURL(blob);
                                link.download = `Ashland_Manifest_${viewDate}.csv`;
                                link.click();
                            }} className="p-4 bg-blue-900 text-white rounded-2xl shadow-lg hover:bg-blue-800 transition-all font-black hover:scale-105 active:scale-95">
                                <UserCheck size={20} />
                            </button>
                        </div>
                    </div>

                    {/* DYNAMIC HEATMAP */}
                    <div className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/40">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h3 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest mb-2">
                                    <Clock size={14} className="text-blue-500" /> Fleet Deployment Graph
                                </h3>
                                {/* HOURLY LOAD SUMMARY (The "Liz" Backup) */}
                                <div className="flex gap-2 overflow-x-auto pb-2 max-w-2xl no-scrollbar mask-gradient-r">
                                    {hourlyFleetUsage.map((count, h) => {
                                        if (count === 0) return null;
                                        const timeLabel = h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`;
                                        return (
                                            <span key={h} className="text-[10px] font-bold bg-white/80 text-slate-600 px-3 py-1.5 rounded-lg whitespace-nowrap border border-slate-100 shadow-sm">
                                                {timeLabel}: <span className="text-blue-600">{count} Ride{count !== 1 && 's'}</span>
                                            </span>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-end h-32 border-b border-slate-200/50 pb-0 gap-2 px-2">
                            {hourlyFleetUsage.slice(6, 22).map((usage, i) => {
                                const hourLabel = i + 6;
                                // LOGIC: If usage > active (red), if usage == active (amber), else blue
                                const barColor = usage > activeVehiclesCount ? 'bg-red-500 shadow-red-200' :
                                    usage === activeVehiclesCount ? 'bg-amber-400 shadow-amber-200' : 'bg-blue-500 shadow-blue-200';

                                // Force integer steps for height calculation visual validation
                                const heightPercentage = Math.max((usage / (activeVehiclesCount || 7)) * 100, 4);

                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group relative min-w-[20px]">
                                        {usage > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="text-[10px] font-black text-slate-600 mb-1">{usage}</motion.div>
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
                        {/* GRAPH LEGEND */}
                        <div className="flex justify-center gap-8 mt-8 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-full shadow-lg shadow-blue-200"></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Booked</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-amber-400 rounded-full shadow-lg shadow-amber-200"></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">At Capacity</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-200"></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Overbooked</span>
                            </div>
                        </div>
                    </div>

                    {/* SEARCH */}
                    <div className="relative mt-8">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input type="text" placeholder="Quick-search names or phone numbers..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm outline-none text-sm font-medium" onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>

                    {/* MANIFEST LISTING */}
                    <div className="grid gap-3">
                        <AnimatePresence mode='popLayout'>
                            {processedData.filtered.length > 0 ? processedData.filtered.map((ride, index) => {
                                const d = new Date(ride.scheduledTime);
                                const isOverbooked = ride.status === 'Confirmed' && hourlyFleetUsage[d.getHours()] > 7;
                                const isElderly = ride.userType === 'Elderly/Disabled';
                                const eta = getETA(ride); // GET ETA

                                return (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2, delay: index * 0.05 }}
                                        key={ride._id}
                                        className={`bg-white/80 backdrop-blur-md p-5 rounded-2xl border-l-4 border-t border-b border-r transition-all flex flex-col lg:flex-row justify-between items-center gap-4 shadow-sm hover:shadow-xl hover:bg-white hover:scale-[1.01] group
                            ${ride.status === 'Confirmed' ? 'border-l-emerald-500 border-white' :
                                                ride.status === 'En-Route' ? 'border-l-blue-500 border-blue-100 bg-blue-50/10' :
                                                    ride.status === 'Rejected' ? 'border-l-red-500 border-red-100 bg-red-50/10' :
                                                        ride.status === 'Completed' ? 'border-l-teal-500 border-teal-100' :
                                                            'border-l-amber-400 border-white'}
                            ${isOverbooked ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}>
                                        <div className="flex-1 space-y-2 w-full">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="text-[10px] font-black bg-slate-800 text-white px-2 py-1 rounded flex items-center gap-1 shadow-md">
                                                    <Ticket size={10} /> {ride.ticketId || `TKT-${index + 100}`}
                                                </span>
                                                <h4 className="font-bold text-slate-800 text-lg tracking-tight">{ride.passengerName}</h4>
                                                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase shadow-sm ${ride.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-700' :
                                                    ride.status === 'En-Route' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                                                        ride.status === 'Completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                            ride.status === 'Rejected' ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-700'
                                                    } `}>{ride.status}</span>
                                                {isElderly && <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 shadow-md shadow-blue-200"><UserCheck size={10} /> PRIORITY</div>}
                                                {isOverbooked && <div className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[8px] font-bold animate-bounce flex items-center gap-1"><ShieldAlert size={10} /> FLEET FULL</div>}
                                            </div>

                                            <div className="text-xs text-slate-500 grid grid-cols-1 md:grid-cols-3 gap-4 pl-1">
                                                <p className="flex items-center gap-2 font-medium"><Phone size={14} className="text-slate-300" /> {ride.phoneNumber}</p>
                                                <p className="flex items-center gap-2 font-bold text-slate-700"><Clock size={14} className="text-blue-500" /> {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                <p className="flex items-center gap-2 text-blue-600 font-bold truncate bg-blue-50/50 px-3 py-1 rounded-lg border border-blue-100/50"><MapPin size={12} className="text-red-400" /> {ride.pickup} → {ride.dropoff}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-between border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-6 border-slate-100">
                                            <div className="flex flex-col gap-1 min-w-[140px]">
                                                <label className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Assign Asset</label>
                                                <div className="relative">
                                                    <select value={ride.assignedVehicle || 'Unassigned'} onChange={(e) => handleVehicleAssign(ride._id, e.target.value)} className="w-full text-[10px] font-bold border border-slate-200 rounded-xl p-2.5 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer">
                                                        <option value="Unassigned">-- Select Asset --</option>
                                                        {vehicles.length > 0 ? vehicles.map(v => (
                                                            <option key={v._id} value={v.name}>{v.name} ({v.type})</option>
                                                        )) : (
                                                            <>
                                                                <option value="Large Van (5)">Large Van (5)</option>
                                                                <option value="Small Car (2)">Small Car (2)</option>
                                                            </>
                                                        )}
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                        <Truck size={12} />
                                                    </div>
                                                </div>
                                                {/* SHOW ETA IF ACTIVE */}
                                                {ride.status === 'En-Route' && (
                                                    <div className="mt-1 text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded animate-pulse text-center">
                                                        Est. Arrival: {eta}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                {/* SMART MAP BUTTON */}
                                                <button onClick={() => {
                                                    const origin = encodeURIComponent(ride.pickup + ", Ashland, OH");
                                                    const dest = encodeURIComponent(ride.dropoff + ", Ashland, OH");
                                                    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`, '_blank');
                                                }} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all hover:scale-110 active:scale-90" title="Open Smart Map">
                                                    <MapPin size={16} />
                                                </button>

                                                {/* EDIT BUTTON */}
                                                <button onClick={() => setEditingRide(ride)} className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all hover:scale-110 active:scale-90" title="Edit Manual Details">
                                                    <Pencil size={16} />
                                                </button>

                                                <button onClick={() => handleStatusUpdate(ride._id, 'Confirmed', ride.scheduledTime)} className="p-2.5 bg-emerald-500 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 hover:scale-110 active:scale-95 transition-all" title="Confirm Ride"><CheckCircle size={16} /></button>

                                                {/* EMERGENCY CANCEL (Only for Confirmed/En-Route) */}
                                                {(ride.status === 'Confirmed' || ride.status === 'En-Route') ? (
                                                    <button onClick={() => handleStatusUpdate(ride._id, 'Cancelled')} className="p-2.5 bg-red-100 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm hover:scale-110 active:scale-90" title="Emergency Cancel">
                                                        <Ban size={16} />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleStatusUpdate(ride._id, 'Rejected')} className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm hover:scale-110 active:scale-90" title="Reject Request"><XCircle size={16} /></button>
                                                )}
                                            </div>

                                            <div className="text-right min-w-[70px]">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{ride.passengers} Pax</p>
                                                <div className="flex flex-col items-end">
                                                    <p className="text-xl font-black text-slate-800 tracking-tight">${ride.fare.toFixed(2)}</p>
                                                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <CircleDollarSign size={8} /> VERIFIED
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            }) : (
                                <div className="py-20 text-center bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300">
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Empty Manifest for {viewDate}</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* RIGHT COLUMN: MAP & METRICS */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="sticky top-24">
                        {/* MAP CONTAINER */}
                        <div className="bg-white p-4 rounded-3xl shadow-2xl shadow-blue-900/10 border border-slate-100 mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2"><MapPin size={14} className="text-blue-600" /> Live Tracking</h3>
                                <span className="bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> ONLINE</span>
                            </div>
                            <div className="h-[400px] w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200">
                                {/* INTEGRATE NEW MAP */}
                                <div className="h-full w-full bg-slate-100">
                                    {/* Just verifying component import */}
                                    {/* <LeafletMap className="h-full" /> */}
                                    {/* We need to pass the mockVehicles to the map if it supports it, or just use the updated map component itself */}
                                    {/* Assuming we modified LeafletMap to accept vehicles prop */}
                                    <LeafletMap className="h-full w-full" vehicles={mockVehicles} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                {mockVehicles.slice(0, 4).map(v => (
                                    <div key={v.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500">{v.name}</p>
                                            <p className="text-[9px] text-slate-400">{v.type}</p>
                                        </div>
                                        <div className="text-emerald-500 font-bold text-xs">30 <span className="text-[8px] text-slate-400">MPH</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* EDIT MODAL */}
            {editingRide && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Pencil size={16} className="text-amber-500" /> Edit Ride Details
                            </h3>
                            <button onClick={() => setEditingRide(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Scheduled Time</label>
                                <input
                                    type="datetime-local"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    defaultValue={dayjs(editingRide.scheduledTime).format('YYYY-MM-DDTHH:mm')} // formatting for input
                                    id="edit-time"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Override Fare ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500 text-emerald-600"
                                    defaultValue={editingRide.fare}
                                    id="edit-fare"
                                />
                            </div>

                            <button onClick={async () => {
                                const newTime = document.getElementById('edit-time').value;
                                const newFare = document.getElementById('edit-fare').value;
                                if (!newTime || newFare === '') return alert("Fields cannot be empty");

                                try {
                                    await updateRideDetails(editingRide._id, {
                                        scheduledTime: newTime,
                                        fare: parseFloat(newFare)
                                    });
                                    setEditingRide(null);
                                    setEditingRide(null);
                                    fetchData(); // Refresh
                                    addToast("Details Updated", 'success');
                                } catch (e) {
                                    addToast("Update Failed", 'error');
                                }
                            }} className="w-full py-3 bg-blue-900 text-white font-black rounded-xl uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg flex items-center justify-center gap-2">
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
                                <Phone size={24} className="text-emerald-500" /> Manual Phone Booking
                            </h3>
                            <button onClick={() => setIsBookingModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
                        </div>

                        <form onSubmit={handleManualBooking} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Passenger Name</label>
                                    <input name="passengerName" required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. John Doe" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Phone Number</label>
                                    <input name="phoneNumber" required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. 555-0199" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pickup Address</label>
                                    <input name="pickup" required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Include House #" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Dropoff Address</label>
                                    <input name="dropoff" required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Include House #" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Date & Time</label>
                                    <input name="scheduledTime" required type="datetime-local" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Group Size</label>
                                    <input name="passengers" required type="number" min="1" max="10" defaultValue="1" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Passenger Type (Fare Calc)</label>
                                <select name="userType" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                                    <option value="General">General Public</option>
                                    <option value="Elderly/Disabled">Elderly / Disabled</option>
                                    <option value="Child">Child</option>
                                </select>
                            </div>

                            <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2 mt-4">
                                <Plus size={18} /> Confirm Manual Booking
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* FOOTER QUICK LINKS */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <a href="/driver" target="_blank" className="hover:text-blue-500 transition-colors flex items-center gap-2"><Truck size={14} /> Open Driver View</a>
                <a href="/fleet" target="_blank" className="hover:text-blue-500 transition-colors flex items-center gap-2"><Truck size={14} /> Fleet Manager</a>
            </div>

            {/* TOAST NOTIFICATIONS CONTAINER */}
            <div className="fixed top-4 right-4 z-[110] flex flex-col items-end">
                <AnimatePresence>
                    {toasts.map(toast => (
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
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmAction(null)}></div>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative z-10 animate-in fade-in zoom-in">
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <ShieldAlert className="text-amber-500" /> Confirm Action
                        </h3>
                        <p className="text-slate-600 font-bold text-sm mb-6">{confirmAction.message}</p>
                        <div className="flex gap-4">
                            <button onClick={() => setConfirmAction(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors uppercase tracking-widest text-xs">Cancel</button>
                            <button onClick={confirmAction.onConfirm} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors uppercase tracking-widest text-xs">Proceed</button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default DispatcherDashboard;