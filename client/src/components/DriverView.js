import React, { useState, useEffect, useCallback } from 'react';
import { getRides, updateRideStatus, getVehicles, updateRideVehicle } from '../services/api';
import { MapPin, CheckCircle, Clock, Truck, User, Hand, X, AlertTriangle } from 'lucide-react';
import LoginModal from './LoginModal';
import Toast from './Toast';
import { AnimatePresence, motion } from 'framer-motion';

const DriverView = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [myRides, setMyRides] = useState([]);
    const [availableRides, setAvailableRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toasts, setToasts] = useState([]);

    // Custom Confirmation State
    const [confirmAction, setConfirmAction] = useState(null); // { type: 'claim'|'update', id: '', status: '', message: '' }

    // TIME TRAVEL ENABLED: Drivers can now look ahead/behind
    const [viewDate, setViewDate] = useState(new Date().toLocaleDateString('en-CA'));

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    const handleLogin = (code) => {
        if (code === "ASH2026") {
            setIsAuthenticated(true);
            return true;
        } else {
            return false;
        }
    };

    const loadFleet = async () => {
        try {
            const data = await getVehicles();
            setVehicles(data);
        } catch (error) {
            console.error("Fleet Load Error", error);
        }
    };

    useEffect(() => {
        loadFleet();
    }, []);

    const loadManifest = useCallback(async () => {
        if (!selectedVehicle) return;
        setLoading(true);
        try {
            const allRides = await getRides();
            // EXPERT SYNC: Use the selected viewDate
            const targetDateStr = viewDate;

            const myRides = allRides.filter(r => {
                const rideDate = new Date(r.scheduledTime).toLocaleDateString('en-CA');
                const isDateMatch = rideDate === targetDateStr;
                const isMyVehicle = r.assignedVehicle === selectedVehicle;

                // Debug Log
                if (isMyVehicle) console.log("DriverView Match:", { id: r.ticketId, rideDate, targetDateStr, status: r.status });

                return (
                    isMyVehicle &&
                    (r.status === 'Confirmed' || r.status === 'En-Route') &&
                    isDateMatch
                );
            });

            const poolRides = allRides.filter(r => {
                const rideDate = new Date(r.scheduledTime).toLocaleDateString('en-CA');
                const isDateMatch = rideDate === targetDateStr;
                // GHOST FIX: Explicitly check for null, undefined, "", "Unassigned", or "Waiting Setup..."
                const isUnassigned = !r.assignedVehicle || r.assignedVehicle === 'Unassigned' || r.assignedVehicle === '' || r.assignedVehicle === 'Waiting Setup...';

                return (
                    isUnassigned &&
                    r.status === 'Confirmed' &&
                    isDateMatch
                );
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
    }, [loadManifest]); // Re-run when vehicle OR date changes via useCallback dependency

    const executeUpdateStatus = async () => {
        if (!confirmAction) return;
        const { id, status } = confirmAction;

        try {
            await updateRideStatus(id, status);
            loadManifest();
            addToast(`Status updated to ${status}`, 'success');
        } catch (error) {
            addToast("Error updating status", 'error');
        } finally {
            setConfirmAction(null);
        }
    };

    const executeClaimRide = async () => {
        if (!confirmAction) return;
        const { id } = confirmAction;

        try {
            // FORCE STATUS CONFIRMED ON CLAIM
            await updateRideVehicle(id, selectedVehicle);
            await updateRideStatus(id, 'Confirmed');
            loadManifest();
            addToast("Ride Claimed Successfully", 'success');
        } catch (error) {
            addToast("Error claiming ride", 'error');
        } finally {
            setConfirmAction(null);
        }
    };

    const requestUpdate = (id, status) => {
        setConfirmAction({
            type: 'update',
            id,
            status,
            message: `Update ride status to ${status}?`
        });
    };

    const requestClaim = (id) => {
        setConfirmAction({
            type: 'claim',
            id,
            message: `Claim ride #${id.substring(id.length - 4)} for ${selectedVehicle}?`
        });
    };

    const changeDate = (days) => {
        const d = new Date(viewDate + "T12:00:00");
        d.setDate(d.getDate() + days);
        setViewDate(d.toLocaleDateString('en-CA'));
    };

    if (!isAuthenticated) return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <LoginModal
                isOpen={true}
                onClose={() => { }}
                onLogin={handleLogin}
                title="Driver Portal"
            />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 pb-20 font-sans">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-wider text-blue-400">Driver Mode</h1>

                    {/* EXPERT DATE PICKER */}
                    <div className="flex items-center gap-3 mt-1">
                        <button onClick={() => changeDate(-1)} className="p-1 bg-slate-800 rounded hover:bg-blue-600 transition-colors">←</button>
                        <input
                            type="date"
                            value={viewDate}
                            onChange={(e) => setViewDate(e.target.value)}
                            className="bg-slate-800 text-white text-xs font-bold border-none rounded p-1 outline-none"
                        />
                        <button onClick={() => changeDate(1)} className="p-1 bg-slate-800 rounded hover:bg-blue-600 transition-colors">→</button>
                    </div>
                </div>
                <Truck className="text-slate-600" />
            </div>

            {/* VEHICLE SELECTOR */}
            <div className="mb-6">
                <select
                    className="w-full p-4 rounded-xl bg-slate-800 border-none text-white font-bold outline-none ring-2 ring-transparent focus:ring-blue-500"
                    value={selectedVehicle}
                    onChange={(e) => setSelectedVehicle(e.target.value)}
                >
                    <option value="">-- Tap to Select Vehicle --</option>
                    {vehicles.map(v => (
                        <option key={v._id} value={v.name}>{v.name} ({v.type})</option>
                    ))}
                </select>
            </div>

            {!selectedVehicle ? (
                <div className="text-center py-20 opacity-50">
                    <Truck size={48} className="mx-auto mb-4 text-slate-600" />
                    <p className="font-bold">Select a vehicle to start</p>
                </div>
            ) : (
                <div className="space-y-8">

                    {/* SECTION 1: MY ACTIVE MANIFEST */}
                    <div>
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Truck size={14} /> My Manifest ({myRides.length})
                        </h2>
                        {loading ? (
                            <div className="animate-pulse h-20 bg-slate-800 rounded-xl"></div>
                        ) : myRides.length === 0 ? (
                            <div className="p-6 bg-slate-800/50 rounded-xl border border-dashed border-slate-700 text-center">
                                <p className="text-slate-500 font-bold text-sm">No active rides assigned.</p>
                                <p className="text-[10px] text-slate-600 uppercase mt-1">Check the pool below</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {myRides.map(ride => (
                                    <RideCard key={ride._id} ride={ride} isAssigned={true} onAction={requestUpdate} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: AVAILABLE POOL */}
                    <div>
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Hand size={14} /> Available Pool ({availableRides.length})
                        </h2>
                        {loading ? (
                            <div className="animate-pulse h-20 bg-slate-800 rounded-xl"></div>
                        ) : availableRides.length === 0 ? (
                            <div className="p-6 bg-slate-800/50 rounded-xl border border-dashed border-slate-700 text-center">
                                <p className="text-slate-500 font-bold text-sm">No Open Rides in Pool.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {availableRides.map(ride => (
                                    <RideCard key={ride._id} ride={ride} isAssigned={false} onAction={requestClaim} />
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            )}
            {/* TOASTS */}
            <div className="fixed top-4 right-4 z-[110] flex flex-col items-end">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
                    ))}
                </AnimatePresence>
            </div>

            {/* CONFIRMATION MODAL */}
            <AnimatePresence>
                {confirmAction && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setConfirmAction(null)}></div>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-800 border border-slate-700 w-full max-w-sm rounded-2xl p-6 relative z-10 shadow-2xl"
                        >
                            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                <AlertTriangle className="text-amber-500" /> Confirm Action
                            </h3>
                            <p className="text-slate-300 font-bold mb-6">{confirmAction.message}</p>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setConfirmAction(null)} className="py-3 bg-slate-700 text-slate-300 font-black rounded-xl hover:bg-slate-600 transition-all uppercase tracking-widest">
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmAction.type === 'claim' ? executeClaimRide : executeUpdateStatus}
                                    className="py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-500 transition-all uppercase tracking-widest"
                                >
                                    Confirm
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

// SUB-COMPONENT FOR CLEANER CODE
const RideCard = ({ ride, isAssigned, onAction }) => (
    <div className={`bg-slate-800 rounded-2xl p-5 border shadow-xl relative overflow-hidden transition-all ${!isAssigned ? 'border-amber-500/30 ring-1 ring-amber-500/20' :
        ride.status === 'En-Route' ? 'border-blue-500/50 ring-1 ring-blue-500/30' :
            'border-slate-700'
        }`}>
        <div className="absolute top-0 right-0 bg-slate-700 px-3 py-1 rounded-bl-xl z-10">
            <span className="text-[10px] font-mono text-slate-400">#{ride.ticketId || '---'}</span>
        </div>

        {ride.status === 'En-Route' && (
            <div className="absolute top-0 left-0 bg-blue-600 px-3 py-1 rounded-br-xl z-10">
                <span className="text-[10px] font-black text-white uppercase flex items-center gap-1"><Truck size={10} /> En-Route</span>
            </div>
        )}

        <div className="flex items-start gap-4 mb-4 mt-6">
            <div className="bg-blue-600/20 p-3 rounded-xl text-blue-400">
                <User size={24} />
            </div>
            <div>
                <h3 className="font-black text-lg">{ride.passengerName}</h3>
                <div className="flex gap-2 mt-2">
                    <span className="bg-blue-900 text-blue-200 text-[10px] px-2 py-0.5 rounded font-bold">{ride.passengers} Pax</span>
                    {ride.userType === 'Elderly/Disabled' && (
                        <span className="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Priority</span>
                    )}
                </div>
            </div>
        </div>

        <div className="space-y-3 mb-6 bg-slate-900/50 p-4 rounded-xl">
            <div className="flex gap-3">
                <Clock size={16} className="text-amber-400 mt-1" />
                <div>
                    <p className="text-[10px] text-slate-500 font-black uppercase">Time</p>
                    <p className="font-mono font-bold text-lg">{new Date(ride.scheduledTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                </div>
            </div>
            <div className="flex gap-3">
                <MapPin size={16} className="text-emerald-400 mt-1" />
                <div className="w-full text-base">
                    <p className="font-bold text-slate-200">{ride.pickup}</p>
                    <div className="h-4 border-l-2 border-dashed border-slate-600 ml-2 my-1"></div>
                    <p className="font-bold text-slate-200">{ride.dropoff}</p>
                </div>
            </div>
        </div>

        {!isAssigned ? (
            <button onClick={() => onAction(ride._id)} className="w-full py-5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 text-lg shadow-lg shadow-amber-900/20 active:scale-95 transition-all">
                <Hand size={24} /> Claim Ride
            </button>
        ) : ride.status === 'Confirmed' ? (
            <button onClick={() => onAction(ride._id, 'En-Route')} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 text-lg shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
                <Truck size={24} /> Start Trip
            </button>
        ) : (
            <button onClick={() => onAction(ride._id, 'Completed')} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 text-lg shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">
                <CheckCircle size={24} /> Complete
            </button>
        )}
    </div>
);

// REMOVED OLD LoginScreen COMPONENT Since we reuse LoginModal
export default DriverView;
