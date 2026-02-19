import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, Calendar, Clock, AlertTriangle, CheckCircle2, MapPin, Users, XCircle, User, UserCheck } from 'lucide-react';
import { createRide, checkCapacity } from '../services/api';
import { calculateFare } from '../utils/fareCalculator'; // Shared Logic
import { motion, AnimatePresence } from 'framer-motion';
import Toast from './Toast';

const BookingForm = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        passengerName: '',
        phoneNumber: '',
        pickup: '',
        dropoff: '',
        userType: 'Standard', // Default to Standard
        isSameDay: false,
        passengers: 1,
        scheduledTime: ''
    });
    const [price, setPrice] = useState(2.00); // Default Standard Price
    const [capacityStatus, setCapacityStatus] = useState(null);
    const [isPast, setIsPast] = useState(false);
    const [isFull, setIsFull] = useState(false);
    const [checking, setChecking] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    // EXPERT: Real-Time Fleet Guard
    useEffect(() => {
        const verifyCapacity = async () => {
            if (formData.scheduledTime) {
                // RESET STATE ON NEW TIME INPUT
                setChecking(true);
                setCapacityStatus(null);
                setIsFull(false);
                setIsPast(false);

                const selectedDate = new Date(formData.scheduledTime);
                const now = new Date();

                if (selectedDate < now) {
                    setIsPast(true);
                    setChecking(false);
                    return; // LOGIC: Blocks requests for past times to save server API calls
                }

                try {
                    // THESIS LOGIC: Real-time synchronization with the Dispatcher's specific fleet count
                    // This call checks the PHYSICAL vehicle count (7) in the backend matches active bookings
                    const result = await checkCapacity(formData.scheduledTime, formData.passengers);
                    setCapacityStatus(result.isBusy ? 'Busy' : 'Normal');
                    setIsFull(result.isFull);
                } catch (error) {
                    console.error("Fleet sync failed");
                } finally {
                    setChecking(false);
                }
            }
        };

        // DEBOUNCE: Wait 500ms after user stops typing/changing time
        const timer = setTimeout(() => {
            verifyCapacity();
        }, 500);

        return () => clearTimeout(timer);
    }, [formData.scheduledTime, formData.passengers]);



    // ... (existing code)

    // FARE ENGINE: Uses Shared Utility for 1:1 Backend Match
    useEffect(() => {
        const calculatedPrice = calculateFare(
            formData.userType,
            formData.isSameDay,
            formData.passengers,
            false, // isOutOfTown (Not yet in form, default to false)
            0      // miles
        );
        setPrice(calculatedPrice);
    }, [formData.userType, formData.isSameDay, formData.passengers]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isFull || isPast || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const response = await createRide({ ...formData, fare: price });
            // AUTO-REDIRECT TO TRACKING PAGE (Encoded for safety)
            navigate(`/track?ticketId=${encodeURIComponent(response.ticketId)}`);

            // Reset form (though we are navigating away, good practice)

            setFormData({
                passengerName: '', phoneNumber: '', pickup: '', dropoff: '',
                userType: 'Standard', isSameDay: false, passengers: 1, scheduledTime: ''
            });
            setCapacityStatus(null);
            setIsFull(false);
            setIsPast(false);
        } catch (error) {
            addToast(error.response?.data?.message || "Fleet Error: Try a different time.", 'error');
        } finally {
            setIsSubmitting(false); // Reset submitting state
        }
    };

    // Helper to handle date change and update formData
    const handleDateChange = (e) => {
        const newTime = e.target.value;
        const date = new Date(newTime);
        const today = new Date();
        // Check if Same Day (ignoring time)
        const isSameDay = date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();

        setFormData({ ...formData, scheduledTime: newTime, isSameDay });
    };

    return (
        <div className="max-w-md mx-auto py-8 px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 border border-white/20 relative overflow-hidden"
            >
                {/* DECORATIVE BLUR */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

                <div className="text-center mb-8 relative z-10">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-blue-500/30 transform hover:scale-110 transition-transform duration-300">
                        <MapPin size={32} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Book a Ride</h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">Ashland City Transit • On-Demand</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    {/* PASSENGER DETAILS */}
                    <div className="space-y-4">
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                            <input type="text" placeholder="Full Name" required className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-slate-50 font-bold text-sm text-slate-800 transition-all shadow-sm"
                                value={formData.passengerName} onChange={(e) => setFormData({ ...formData, passengerName: e.target.value })} />
                        </div>
                        <div className="relative group">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                            <input type="text" placeholder="Phone Number" required className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition-all shadow-sm"
                                value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} />
                        </div>
                    </div>

                    {/* LOCATION DETAILS */}
                    <div className="space-y-3 pt-2">
                        <div className="relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 transition-colors" size={20} />
                            <input type="text" placeholder="Pickup Address" required className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-slate-50 font-bold text-slate-800 transition-all shadow-sm"
                                value={formData.pickup} onChange={(e) => setFormData({ ...formData, pickup: e.target.value })} />
                        </div>

                        {/* NEW: LAST 100 FEET */}
                        <div className="relative group">
                            <input type="text" placeholder="Pickup Details (e.g. Wearing Red Hat)" className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-400/50 focus:border-slate-400 bg-slate-50 text-sm font-medium transition-all shadow-sm"
                                value={formData.pickupDetails || ''} onChange={(e) => setFormData({ ...formData, pickupDetails: e.target.value })} />
                        </div>

                        <div className="relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500 transition-colors" size={20} />
                            <input type="text" placeholder="Drop-off Address" required className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 bg-slate-50 font-bold text-slate-800 transition-all shadow-sm"
                                value={formData.dropoff} onChange={(e) => setFormData({ ...formData, dropoff: e.target.value })} />
                        </div>
                    </div>

                    {/* TIME & PASSENGERS */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="relative group">
                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                            <input type="datetime-local" required className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-slate-50 font-bold text-slate-800 text-xs transition-all shadow-sm appearance-none"
                                value={formData.scheduledTime} onChange={handleDateChange} />
                        </div>
                        <div className="relative group">
                            <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                            <input type="number" min="1" max="10" placeholder="Pax" required className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-slate-50 font-bold text-slate-800 transition-all shadow-sm"
                                value={formData.passengers} onChange={(e) => setFormData({ ...formData, passengers: parseInt(e.target.value) })} />
                        </div>
                    </div>

                    {/* DYNAMIC LOCK STATUS */}
                    {checking ? (
                        <p className="text-[10px] text-blue-500 font-bold animate-pulse ml-2 uppercase">Checking Fleet Availability...</p>
                    ) : isPast ? (
                        <div className="p-4 bg-red-600 rounded-2xl flex items-center gap-3 text-white shadow-lg shadow-red-100">
                            <Calendar size={20} />
                            <div>
                                <p className="text-xs font-black uppercase">Invalid Time</p>
                                <p className="text-[9px] opacity-90 leading-tight text-white">Cannot book rides in the past. Please select a future time.</p>
                            </div>
                        </div>
                    ) : isFull ? (
                        <div className="p-4 bg-red-600 rounded-2xl flex items-center gap-3 text-white shadow-lg shadow-red-100">
                            <XCircle size={20} />
                            <div>
                                <p className="text-xs font-black uppercase">Fleet Fully Booked</p>
                                <p className="text-[9px] opacity-90 leading-tight text-white">All 7 vehicles are currently dispatched. Try a different time slot.</p>
                            </div>
                        </div>
                    ) : capacityStatus === 'Busy' ? (
                        <div className="p-3 bg-amber-100 border border-amber-200 rounded-2xl flex items-center gap-2 text-amber-800">
                            <AlertTriangle size={16} />
                            <p className="text-[10px] font-bold uppercase">High Demand Window</p>
                        </div>
                    ) : formData.scheduledTime && (
                        <div className="p-3 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-800">
                            <CheckCircle2 size={16} />
                            <p className="text-[10px] font-bold uppercase">Slots Available</p>
                        </div>
                    )}

                    {/* USER TYPE SELECTOR (Expanded for Clarity) */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Passenger Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Standard', 'Senior', 'Student', 'Veteran', 'Elderly/Disabled', 'Child'].map((type) => (
                                <button key={type} type="button" onClick={() => setFormData({ ...formData, userType: type })}
                                    className={`py-2 px-1 text-[10px] font-black rounded-xl transition-all border ${formData.userType === type ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* PASSENGER ADJUSTER */}
                    <div className="flex items-center justify-between p-3 border-2 border-slate-50 rounded-2xl bg-white">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            <Users size={16} /> Group size
                        </div>
                        <div className="flex items-center gap-4">
                            <button type="button" onClick={() => setFormData({ ...formData, passengers: Math.max(1, formData.passengers - 1) })} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-blue-600 hover:bg-blue-50">-</button>
                            <span className="font-black text-sm w-4 text-center">{formData.passengers}</span>
                            <button type="button" onClick={() => setFormData({ ...formData, passengers: formData.passengers + 1 })} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-blue-600 hover:bg-blue-50">+</button>
                        </div>
                    </div>

                    {/* TOTAL FARE */}
                    <div className="p-4 bg-blue-950 rounded-[1.5rem] flex justify-between items-center text-white shadow-xl">
                        <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">Est. Total Fare</span>
                        <span className="text-2xl font-black tracking-tighter">${price.toFixed(2)}</span>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button
                        type="submit"
                        disabled={isFull || checking || isPast || isSubmitting}
                        className={`w-full py-4 rounded-[1.5rem] font-black text-sm tracking-widest transition-all transform active:scale-95 shadow-xl uppercase 
                            ${isFull || isPast || isSubmitting ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                        {isFull || isPast ? "Unavailable" : checking ? "Verifying..." : isSubmitting ? "Bookings..." : "Confirm Booking"}
                    </button>
                </form>
            </motion.div>

            <div className="text-center mt-6">
                <Link to="/track" className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-widest">
                    Already have a ticket? Track it here
                </Link>
            </div>


            {/* TOASTS */}
            <div className="fixed top-4 right-4 z-[110] flex flex-col items-end">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
                    ))}
                </AnimatePresence>
            </div>
        </div >
    );
};

export default BookingForm;