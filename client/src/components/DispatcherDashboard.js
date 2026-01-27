import React, { useState, useEffect, useMemo } from 'react';
import { getRides, updateRideStatus, updateRideVehicle } from '../services/api';
import { Clock, MapPin, CheckCircle, XCircle, Phone, Search, Calendar, Truck, ShieldAlert, ChevronLeft, ChevronRight, AlertTriangle, UserCheck } from 'lucide-react';

const DispatcherDashboard = () => {
    const [rides, setRides] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    
    // EXPERT DATE MATCHER: Prevents the "Empty Graph" by ignoring UTC offsets
    const getLocalISO = (date) => {
        const d = new Date(date);
        return d.getFullYear() + '-' + 
               String(d.getMonth() + 1).padStart(2, '0') + '-' + 
               String(d.getDate()).padStart(2, '0');
    };

    const [viewDate, setViewDate] = useState(getLocalISO(new Date()));

    const fetchRides = async () => {
        try {
            const data = await getRides();
            setRides(data);
            setLoading(false);
        } catch (error) {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRides(); }, []);

    // ENABLE REDO: Allows toggling between Confirmed/Rejected to "Shuffle" the 7 slots
    const handleStatusUpdate = async (id, newStatus, rideTime) => {
        if (newStatus === 'Confirmed') {
            const d = new Date(rideTime);
            const currentConfirmedInHour = hourlyFleetUsage[d.getHours()] || 0;
            if (currentConfirmedInHour >= 7) {
                alert("FLEET FULL: You must reject or reschedule another ride for this hour before confirming a new one.");
                return;
            }
        }
        try {
            await updateRideStatus(id, newStatus);
            fetchRides(); 
        } catch (e) {
            alert("Update Failed");
        }
    };

    const handleVehicleAssign = async (id, vehicle) => {
        try { await updateRideVehicle(id, vehicle); fetchRides(); } catch (e) { alert("Assignment Failed"); }
    };

    // --- EXPERT ENGINE: LOCALIZED SYNC & PRIORITY SORTING ---
    const processedData = useMemo(() => {
        const stats = Array(24).fill(0);
        
        const filtered = rides
            .filter(ride => {
                const d = new Date(ride.scheduledTime);
                const isDateMatch = getLocalISO(d) === viewDate;
                
                // CRITICAL: This is what populates your Heatmap
                if (isDateMatch && ride.status === 'Confirmed') {
                    stats[d.getHours()]++;
                }

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

        return { filtered, stats };
    }, [rides, viewDate, searchTerm]);

    const hourlyFleetUsage = processedData.stats;
    const peakUsage = Math.max(...hourlyFleetUsage);
    const dailyRevenue = processedData.filtered.reduce((acc, r) => r.status === 'Confirmed' ? acc + r.fare : acc, 0);

    if (loading) return <div className="p-10 text-center font-bold text-blue-600 animate-pulse tracking-widest uppercase">Syncing Manifest...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-4 pb-20 p-4 bg-slate-50/50 min-h-screen text-slate-800">
            
            {/* COMPACT DASHBOARD HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
                    <button onClick={() => {
                        const d = new Date(viewDate + "T12:00:00");
                        d.setDate(d.getDate() - 1);
                        setViewDate(getLocalISO(d));
                    }} className="p-2 bg-white hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-sm text-blue-600"><ChevronLeft size={18}/></button>
                    
                    <div className="flex flex-col items-center px-6">
                        <input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} className="font-bold text-sm outline-none bg-transparent cursor-pointer" />
                        <span className="text-[9px] font-black text-blue-500 uppercase">{new Date(viewDate + "T12:00:00").toLocaleDateString(undefined, { weekday: 'long' })}</span>
                    </div>

                    <button onClick={() => {
                        const d = new Date(viewDate + "T12:00:00");
                        d.setDate(d.getDate() + 1);
                        setViewDate(getLocalISO(d));
                    }} className="p-2 bg-white hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-sm text-blue-600"><ChevronRight size={18}/></button>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right border-r pr-6 border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Revenue</p>
                        <p className="text-xl font-black text-emerald-600">${dailyRevenue.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fleet Peak</p>
                        <p className={`text-xl font-black ${peakUsage > 7 ? 'text-red-600' : 'text-blue-900'}`}>{peakUsage} / 7</p>
                    </div>
                </div>
            </div>

            {/* ERROR ALERT: If Overbooked */}
            {peakUsage > 7 && (
                <div className="p-4 bg-red-600 rounded-xl text-white flex items-center justify-between shadow-lg animate-pulse">
                    <div className="flex items-center gap-3">
                        <ShieldAlert size={20} />
                        <p className="font-bold text-[10px] uppercase tracking-wider italic text-white">Critical Overbook: Please reject a non-priority ride</p>
                    </div>
                </div>
            )}

            {/* DYNAMIC HEATMAP */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-[9px] font-black text-slate-400 uppercase mb-6 flex items-center gap-2 tracking-widest">
                    <Clock size={12} className="text-blue-500"/> Fleet Deployment Graph
                </h3>
                <div className="flex items-end gap-1.5 h-32 border-b border-slate-50 pb-2">
                    {hourlyFleetUsage.slice(6, 22).map((usage, i) => {
                        const hourLabel = i + 6;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                    {usage} Vehicles Confirmed
                                </div>
                                <div 
                                    className={`w-full rounded-t-md transition-all duration-700 ${usage > 7 ? 'bg-red-600' : usage === 7 ? 'bg-red-500' : usage >= 5 ? 'bg-amber-400' : usage > 0 ? 'bg-blue-500' : 'bg-slate-100'}`}
                                    style={{ height: `${Math.max((usage / 7) * 100, 5)}%` }}
                                ></div>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">
                                    {hourLabel > 12 ? `${hourLabel - 12}p` : hourLabel === 12 ? '12p' : `${hourLabel}a`}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SEARCH */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Quick-search names or phone numbers..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm outline-none text-sm font-medium" onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            {/* MANIFEST LISTING */}
            <div className="grid gap-3">
                {processedData.filtered.length > 0 ? processedData.filtered.map((ride, index) => {
                    const d = new Date(ride.scheduledTime);
                    const isOverbooked = ride.status === 'Confirmed' && hourlyFleetUsage[d.getHours()] > 7;
                    const isElderly = ride.userType === 'Elderly/Disabled';
                    
                    return (
                        <div key={ride._id} className={`bg-white p-4 rounded-2xl border transition-all flex flex-col lg:flex-row justify-between items-center gap-4 ${isOverbooked ? 'border-red-300 bg-red-50/30' : 'border-slate-100 shadow-sm'}`}>
                            <div className="flex-1 space-y-2 w-full">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[8px] font-black bg-slate-800 text-white px-1.5 py-0.5 rounded">#{index + 1}</span>
                                    <h4 className="font-bold text-slate-900 text-base">{ride.passengerName}</h4>
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${ride.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-700' : ride.status === 'Rejected' ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-700'}`}>{ride.status}</span>
                                    {isElderly && <div className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[8px] font-bold flex items-center gap-1"><UserCheck size={10}/> PRIORITY</div>}
                                    {isOverbooked && <div className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[8px] font-bold animate-bounce flex items-center gap-1"><ShieldAlert size={10}/> FLEET FULL</div>}
                                </div>

                                <div className="text-[11px] text-slate-500 grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <p className="flex items-center gap-2"><Phone size={12} className="text-blue-400"/> {ride.phoneNumber}</p>
                                    <p className="flex items-center gap-2 font-bold text-slate-700"><Clock size={12} className="text-blue-500"/> {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    <p className="flex items-center gap-2 text-blue-600 font-bold truncate bg-blue-50/50 px-2 py-0.5 rounded-md"><MapPin size={12} className="text-red-400"/> {ride.pickup} → {ride.dropoff}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-between border-t lg:border-t-0 lg:border-l pt-3 lg:pt-0 lg:pl-4 border-slate-100">
                                <div className="flex flex-col gap-1 min-w-[140px]">
                                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Assign Asset</label>
                                    <select value={ride.assignedVehicle || 'Unassigned'} onChange={(e) => handleVehicleAssign(ride._id, e.target.value)} className="text-[10px] font-bold border-2 border-slate-100 rounded-lg p-2 bg-slate-50 outline-none">
                                        <option value="Unassigned">Waiting Setup...</option>
                                        <option value="Large Van (5)">Large Van (5)</option>
                                        <option value="Small Car (2)">Small Car (2)</option>
                                    </select>
                                </div>
                                
                                <div className="flex gap-2">
                                    <button onClick={() => handleStatusUpdate(ride._id, 'Confirmed', ride.scheduledTime)} className="p-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 transition-colors"><CheckCircle size={16}/></button>
                                    <button onClick={() => handleStatusUpdate(ride._id, 'Rejected')} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"><XCircle size={16}/></button>
                                </div>

                                <div className="text-right min-w-[60px]">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{ride.passengers} Pax</p>
                                    <p className="text-lg font-black text-slate-900">${ride.fare.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-100">
                        <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest tracking-widest">Empty Manifest for {viewDate}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DispatcherDashboard;