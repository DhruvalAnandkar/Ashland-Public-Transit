import React, { useState, useEffect } from 'react';
import { getRideByTicket } from '../services/api';
import { Search, MapPin, ArrowLeft, AlertTriangle, Phone, Copy, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';

const TrackRide = () => {
    const [searchParams] = useSearchParams();
    const [ticketId, setTicketId] = useState(searchParams.get('ticketId') || '');
    const [ride, setRide] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        if (ride?.ticketId) {
            navigator.clipboard.writeText(ride.ticketId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // HELPER: Fetch Logic
    const fetchRideStatus = async (id) => {
        try {
            // Trim just in case, encoding happens in api.js
            const data = await getRideByTicket(id.trim());
            setRide(data);
            setError('');
        } catch (err) {
            setError("Ticket ID not found. Please check and try again.");
            setRide(null);
        }
    };

    // 1. AUTO-RUN: If URL has ID, fetch immediately
    useEffect(() => {
        const urlId = searchParams.get('ticketId');
        if (urlId) {
            setTicketId(urlId);
            setLoading(true);
            fetchRideStatus(urlId).finally(() => setLoading(false));
        }
    }, [searchParams]);

    // 2. LIVE UPDATES: Poll every 10 seconds if we have a valid ride
    useEffect(() => {
        if (!ride || ride.status === 'Completed' || ride.status === 'Cancelled') return;

        const interval = setInterval(() => {
            fetchRideStatus(ticketId);
        }, 10000); // 10 Seconds

        return () => clearInterval(interval);
    }, [ride, ticketId]);

    const handleTrack = async (e) => {
        e.preventDefault();
        setLoading(true);
        await fetchRideStatus(ticketId);
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 font-sans flex flex-col items-center">
            {/* Header */}
            <div className="w-full max-w-md flex items-center justify-between mb-8 pt-4">
                <Link to="/" className="p-2 bg-white rounded-xl shadow-sm hover:bg-slate-100 transition-colors">
                    <ArrowLeft size={20} className="text-slate-600" />
                </Link>
                <h1 className="text-lg font-black text-slate-800 uppercase tracking-widest">Track My Ride</h1>
                <div className="w-10"></div> {/* Spacer for center alignment */}
            </div>

            <AnimatePresence mode='wait'>
                {!ride ? (
                    <motion.div
                        key="search"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-md bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] mb-6 border border-slate-100"
                    >
                        <form onSubmit={handleTrack} className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Enter Ticket ID (e.g. ASH-ICB)"
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-lg outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 transition-all uppercase placeholder:normal-case placeholder:font-medium text-center tracking-widest text-slate-800 shadow-sm"
                                    value={ticketId}
                                    onChange={(e) => setTicketId(e.target.value.toUpperCase())}
                                />
                            </div>
                            <button
                                disabled={!ticketId || loading}
                                className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                            >
                                {loading ? "Searching..." : "Track Ride"}
                            </button>
                        </form>

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                                <AlertTriangle size={16} /> {error}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="status"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-md"
                    >
                        {/* RIDE STATUS CARD */}
                        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden border border-white/20 relative">
                            {/* LIVE STATUS BANNER */}
                            <div className={`p-6 text-center ${ride.status === 'En-Route' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <h2 className="text-3xl font-black uppercase tracking-tighter">{ride.status}</h2>
                                {ride.status === 'En-Route' && <p className="text-blue-200 font-bold animate-pulse mt-1">Driver is on the way!</p>}
                            </div>

                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">Your Ticket</h2>
                                        <div className="flex items-center gap-2 mt-1 clickable" onClick={copyToClipboard}>
                                            <p className="text-slate-500 font-mono text-sm cursor-pointer hover:text-blue-600 transition-colors" title="Click to copy">#{ride.ticketId}</p>
                                            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-slate-300 hover:text-blue-500 cursor-pointer" />}
                                            <span className={`text-[10px] font-bold ${copied ? 'text-emerald-500 opacity-100' : 'opacity-0'} transition-opacity`}>Copied!</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Fare</p>
                                        <p className="text-2xl font-black text-slate-900">${ride.fare.toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex gap-4 items-start">
                                        <div className="mt-1 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                            <MapPin size={16} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase">Pickup</p>
                                            <p className="font-bold text-slate-800">{ride.pickup}</p>
                                            {ride.pickupDetails && (
                                                <p className="text-xs text-amber-600 font-bold mt-1 bg-amber-50 inline-block px-2 py-1 rounded-lg">
                                                    Note: {ride.pickupDetails}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 items-start">
                                        <div className="mt-1 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                                            <MapPin size={16} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase">Drop-off</p>
                                            <p className="font-bold text-slate-800">{ride.dropoff}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 grid gap-3">
                                    <button onClick={() => {
                                        const origin = encodeURIComponent(ride.pickup + ", Ashland, OH");
                                        const dest = encodeURIComponent(ride.dropoff + ", Ashland, OH");
                                        window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`, '_blank');
                                    }} className="w-full py-4 bg-blue-50 text-blue-700 font-black rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 uppercase text-xs tracking-wider">
                                        <MapPin size={18} /> View Route Map
                                    </button>

                                    <a href="tel:5550199" className="w-full py-4 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 uppercase text-xs tracking-wider">
                                        <Phone size={18} /> Call Dispatch
                                    </a>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TrackRide;
