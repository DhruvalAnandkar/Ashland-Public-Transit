import React, { useState, useEffect } from 'react';
import { getRides } from '../services/api';
import { Clock, MapPin, User, CheckCircle, AlertCircle } from 'lucide-react';

const DispatcherDashboard = () => {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRides = async () => {
            try {
                const data = await getRides();
                setRides(data);
                setLoading(false);
            } catch (error) {
                console.error("Failed to fetch rides");
                setLoading(false);
            }
        };
        fetchRides();
    }, []);

    if (loading) return <div className="p-10 text-center">Loading Manifest...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800">Daily Transit Manifest</h2>
                <span className="bg-blue-100 text-blue-800 px-4 py-1 rounded-full text-sm font-bold">
                    {rides.length} Total Requests
                </span>
            </div>

            <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Passenger</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Route</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Type</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Fare</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rides.map((ride) => (
                            <tr key={ride._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">{ride.passengerName}</td>
                                <td className="px-6 py-4">
                                    <div className="text-xs text-gray-500 flex flex-col gap-1">
                                        <span className="flex items-center gap-1"><MapPin size={12} className="text-green-500"/> {ride.pickup}</span>
                                        <span className="flex items-center gap-1"><MapPin size={12} className="text-red-500"/> {ride.dropoff}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {ride.userType} {ride.isSameDay && <span className="text-red-500 font-bold ml-1">(Same Day)</span>}
                                </td>
                                <td className="px-6 py-4 font-bold text-blue-700">${ride.fare.toFixed(2)}</td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        <Clock size={12}/> Requested
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DispatcherDashboard;