import React, { useState, useEffect } from 'react';
import { getVehicles, updateVehicleStatus } from '../services/api';
import { Wrench } from 'lucide-react';

const FleetManager = () => {
    const [vehicles, setVehicles] = useState([]);

    useEffect(() => {
        loadFleet();
    }, []);

    const loadFleet = async () => {
        try {
            const data = await getVehicles();
            setVehicles(data);
        } catch (error) {
            console.error("Error loading fleet", error);
        }
    };

    const toggleStatus = async (vehicle) => {
        const newStatus = vehicle.status === 'Active' ? 'In Shop' : 'Active';
        try {
            // Optimistic Update
            setVehicles(vehicles.map(v => v._id === vehicle._id ? { ...v, status: newStatus } : v));
            await updateVehicleStatus(vehicle._id, newStatus);
        } catch (error) {
            alert("Failed to update status");
            loadFleet(); // Revert
        }
    };

    const activeCount = vehicles.filter(v => v.status === 'Active').length;
    const healthPercentage = Math.round((activeCount / vehicles.length) * 100) || 0;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <Wrench className="text-slate-600" /> Fleet Assets
                    </h2>
                    <p className="text-sm text-slate-500 font-bold mt-1">Operational Fleet: {activeCount} / {vehicles.length} Vehicles Active</p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-black text-slate-800">{activeCount}/{vehicles.length}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Units</div>
                </div>
            </div>

            {/* HEALTH BAR */}
            <div className="mb-8 bg-slate-100 rounded-full h-4 overflow-hidden">
                <div
                    className={`h-full transition-all duration-500 ${healthPercentage > 70 ? 'bg-emerald-500' : healthPercentage > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${healthPercentage}%` }}
                ></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehicles.map(vehicle => (
                    <div
                        key={vehicle._id}
                        className={`p-5 rounded-2xl border-2 transition-all ${vehicle.status === 'Active'
                            ? 'bg-white border-slate-100 shadow-sm'
                            : 'bg-slate-50 border-slate-200 opacity-75'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-black text-lg text-slate-800">{vehicle.name}</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase">{vehicle.type}</p>
                            </div>
                            <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${vehicle.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                                }`}>
                                {vehicle.status}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-slate-400">
                                Cap: {vehicle.capacity} Pax
                            </div>
                            <button
                                onClick={() => toggleStatus(vehicle)}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${vehicle.status === 'Active'
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                    }`}
                            >
                                {vehicle.status === 'Active' ? 'Send to Shop' : 'Return to Service'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FleetManager;
