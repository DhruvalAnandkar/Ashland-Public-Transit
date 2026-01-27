import React, { useState, useEffect } from 'react';
import { Car, Phone, Calendar, AlertTriangle, CheckCircle2, MapPin, Users, XCircle, Lock } from 'lucide-react';
import { createRide, checkCapacity } from '../services/api';

const BookingForm = () => {
    const [formData, setFormData] = useState({
        passengerName: '',
        phoneNumber: '',
        pickup: '',
        dropoff: '',
        userType: 'General',
        isSameDay: false,
        passengers: 1,
        scheduledTime: ''
    });
    const [price, setPrice] = useState(3.00);
    const [capacityStatus, setCapacityStatus] = useState(null);
    const [isFull, setIsFull] = useState(false);
    const [checking, setChecking] = useState(false);

    // EXPERT: Real-Time Fleet Guard
    useEffect(() => {
        const verifyCapacity = async () => {
            if (formData.scheduledTime) {
                setChecking(true);
                try {
                    // This call checks the PHYSICAL vehicle count (7) in the backend
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
        verifyCapacity();
    }, [formData.scheduledTime, formData.passengers]);

    // FARE ENGINE
    useEffect(() => {
        let basePrice = formData.userType === 'Elderly/Disabled' 
            ? (formData.isSameDay ? 2.50 : 1.50) 
            : (formData.isSameDay ? 5.00 : 3.00);
        
        if (formData.passengers > 1) {
            setPrice(basePrice + (basePrice / 2) * (formData.passengers - 1));
        } else {
            setPrice(basePrice);
        }
    }, [formData.userType, formData.isSameDay, formData.passengers]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isFull) return; 

        try {
            await createRide({ ...formData, fare: price });
            alert("SUCCESS: Request sent to Ashland Dispatch for review.");
            
            setFormData({
                passengerName: '', phoneNumber: '', pickup: '', dropoff: '',
                userType: 'General', isSameDay: false, passengers: 1, scheduledTime: ''
            });
            setCapacityStatus(null);
            setIsFull(false);
        } catch (error) {
            alert(error.response?.data?.message || "Fleet Error: Try a different time.");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-white rounded-[2rem] shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                    <Car className="text-blue-600" size={24} /> Book a Transit Trip
                </h2>
                {isFull && <Lock className="text-red-500 animate-pulse" size={20} />}
            </div>

            <div className="space-y-3">
                <input type="text" placeholder="Full Name" required className="w-full px-4 py-3 border-2 border-slate-50 rounded-2xl outline-none focus:border-blue-500 bg-slate-50/50 font-medium"
                    value={formData.passengerName} onChange={(e) => setFormData({...formData, passengerName: e.target.value})} />
                
                <div className="relative">
                    <Phone className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    <input type="tel" placeholder="Phone Number" required className="w-full pl-12 pr-4 py-3 border-2 border-slate-50 rounded-2xl outline-none focus:border-blue-500 bg-slate-50/50 font-medium"
                        value={formData.phoneNumber} onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} />
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <input type="text" placeholder="Pickup Address" required className="w-full px-4 py-3 border-2 border-slate-50 rounded-2xl outline-none focus:border-blue-500 bg-slate-50/50 font-medium"
                        value={formData.pickup} onChange={(e) => setFormData({...formData, pickup: e.target.value})} />
                    <input type="text" placeholder="Drop-off Address" required className="w-full px-4 py-3 border-2 border-slate-50 rounded-2xl outline-none focus:border-blue-500 bg-slate-50/50 font-medium"
                        value={formData.dropoff} onChange={(e) => setFormData({...formData, dropoff: e.target.value})} />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Select Date & Time</label>
                    <input type="datetime-local" required 
                        className={`w-full px-4 py-3 border-2 rounded-2xl outline-none transition-all font-bold ${isFull ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-50 bg-slate-50/50'}`}
                        value={formData.scheduledTime} onChange={(e) => setFormData({...formData, scheduledTime: e.target.value})} />

                    {/* DYNAMIC LOCK STATUS */}
                    {checking ? (
                        <p className="text-[10px] text-blue-500 font-bold animate-pulse ml-2 uppercase">Checking Fleet Availability...</p>
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
                </div>

                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                    {['General', 'Elderly/Disabled'].map((type) => (
                        <button key={type} type="button" onClick={() => setFormData({...formData, userType: type})}
                            className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${formData.userType === type ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            {type}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between p-3 border-2 border-slate-50 rounded-2xl bg-white">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Users size={16}/> Group size
                    </div>
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => setFormData({...formData, passengers: Math.max(1, formData.passengers - 1)})} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-blue-600 hover:bg-blue-50">-</button>
                        <span className="font-black text-sm w-4 text-center">{formData.passengers}</span>
                        <button type="button" onClick={() => setFormData({...formData, passengers: formData.passengers + 1})} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-blue-600 hover:bg-blue-50">+</button>
                    </div>
                </div>

                <div className="p-4 bg-blue-950 rounded-[1.5rem] flex justify-between items-center text-white shadow-xl">
                    <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">Est. Total Fare</span>
                    <span className="text-2xl font-black tracking-tighter">${price.toFixed(2)}</span>
                </div>

                <button 
                    type="submit" 
                    disabled={isFull || checking}
                    className={`w-full py-4 rounded-[1.5rem] font-black text-sm tracking-widest transition-all transform active:scale-95 shadow-xl uppercase 
                    ${isFull ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                    {isFull ? "No Slots Available" : checking ? "Verifying..." : "Confirm Booking"}
                </button>
            </div>
        </form>
    );
};

export default BookingForm;