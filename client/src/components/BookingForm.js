import React, { useState, useEffect } from 'react';
import { MapPin, Info, Car, Users } from 'lucide-react';
import { createRide } from '../services/api';

const BookingForm = () => {
    const [formData, setFormData] = useState({
        passengerName: '', // Added this to match your backend logic
        pickup: '',
        dropoff: '',
        userType: 'General',
        isSameDay: false,
        passengers: 1
    });
    const [price, setPrice] = useState(3.00);

    // Automatic Price Calculation based on APT rules
    useEffect(() => {
        let basePrice = 3.00; 
        if (formData.userType === 'Elderly/Disabled') {
            basePrice = formData.isSameDay ? 2.50 : 1.50;
        } else {
            basePrice = formData.isSameDay ? 5.00 : 3.00;
        }

        if (formData.passengers > 1) {
            const secondPersonPrice = basePrice / 2;
            setPrice(basePrice + secondPersonPrice * (formData.passengers - 1));
        } else {
            setPrice(basePrice);
        }
    }, [formData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const rideRequest = {
                ...formData,
                fare: price,
                scheduledTime: new Date()
            };
            
            const result = await createRide(rideRequest);
            alert(`Success! Ride requested for ${formData.passengerName}`);
        } catch (error) {
            console.error(error);
            alert("Failed to book ride. Ensure your backend server is running on port 5000.");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-2xl border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
                <Car className="text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Book Your Ride</h2>
            </div>

            <div className="space-y-4">
                {/* Passenger Name */}
                <input 
                    type="text" 
                    placeholder="Your Full Name"
                    required
                    className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => setFormData({...formData, passengerName: e.target.value})}
                />

                {/* Locations */}
                <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400 size-5" />
                    <input 
                        type="text" 
                        placeholder="Pickup Address" 
                        required
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        onChange={(e) => setFormData({...formData, pickup: e.target.value})}
                    />
                </div>

                <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400 size-5" />
                    <input 
                        type="text" 
                        placeholder="Drop-off Address" 
                        required
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        onChange={(e) => setFormData({...formData, dropoff: e.target.value})}
                    />
                </div>

                {/* User Type */}
                <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
                    {['General', 'Elderly/Disabled'].map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({...formData, userType: type})}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.userType === type ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {/* Same Day Toggle */}
                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                    <input 
                        type="checkbox" 
                        checked={formData.isSameDay}
                        onChange={(e) => setFormData({...formData, isSameDay: e.target.checked})}
                        className="size-5 accent-blue-600"
                    />
                    <span className="text-sm text-gray-700 font-medium">Same Day Service</span>
                    <Info className="size-4 text-gray-400 ml-auto" />
                </label>

                {/* Price Display */}
                <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-center">
                        <span className="text-blue-800 font-semibold">Estimated Fare</span>
                        <span className="text-2xl font-black text-blue-900">${price.toFixed(2)}</span>
                    </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-200 mt-4">
                    Confirm Ride Request
                </button>
            </div>
        </form>
    );
};

export default BookingForm;