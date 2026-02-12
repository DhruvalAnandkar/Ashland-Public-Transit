import React, { useState, useEffect } from 'react';
import { getVehicles, updateVehicleStatus } from '../services/api';
import { Wrench } from 'lucide-react';

const FleetManager = () => {
    const [vehicles, setVehicles] = useState([]);

    const [showServiceModal, setShowServiceModal] = useState(false);
    const [selectedForService, setSelectedForService] = useState(null);

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

    const handleAddService = async (e) => {
        e.preventDefault();
        // Since we don't have a specific API route for adding maintenance in the prompt reqs yet, 
        // we'll simulate or add a placeholder comment. 
        // *Self-correction*: I should add the logic to update the vehicle details.
        // For now, I'll assume standard vehicle update or just close modal + visual update.
        // Wait, the user asked for "Service Log button". I'll add the UI first.
        setShowServiceModal(false);
        setSelectedForService(null);
        alert("Service Record logic to be connected to backend API");
    };

    const activeCount = vehicles.filter(v => v.status === 'Active').length;
    const healthPercentage = Math.round((activeCount / vehicles.length) * 100) || 0;

    return (
        <div className="p-6 max-w-6xl mx-auto">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vehicles.map(vehicle => {
                    const isServiceDue = (vehicle.engineHours || 0) > 5000;
                    return (
                        <div
                            key={vehicle._id}
                            className={`p-6 rounded-2xl border-2 transition-all relative overflow-hidden group ${vehicle.status === 'Active'
                                ? 'bg-white border-slate-100 shadow-sm hover:shadow-xl'
                                : 'bg-slate-50 border-slate-200 opacity-75'
                                }`}
                        >
                            {isServiceDue && (
                                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl z-10 animate-pulse uppercase tracking-wider">
                                    Service Required
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="font-black text-xl text-slate-800">{vehicle.name}</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase">{vehicle.type}</p>
                                </div>
                                <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${vehicle.status === 'Active'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {vehicle.status}
                                </div>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-slate-400 uppercase text-[10px]">Capacity</span>
                                    <span className="font-bold text-slate-700">{vehicle.capacity} Pax</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-slate-400 uppercase text-[10px]">Engine Hours</span>
                                    <span className={`font-bold ${isServiceDue ? 'text-red-600' : 'text-slate-700'}`}>{vehicle.engineHours || 0} hrs</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-slate-400 uppercase text-[10px]">Last Service</span>
                                    <span className="font-bold text-slate-700">{vehicle.lastServiceDate ? new Date(vehicle.lastServiceDate).toLocaleDateString() : 'N/A'}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => { setSelectedForService(vehicle); setShowServiceModal(true); }}
                                    className="px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                >
                                    Service Log
                                </button>
                                <button
                                    onClick={() => toggleStatus(vehicle)}
                                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${vehicle.status === 'Active'
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                        }`}
                                >
                                    {vehicle.status === 'Active' ? 'Send to Shop' : 'Return to Service'}
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* SERVICE MODAL PLACEHOLDER */}
            {showServiceModal && selectedForService && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-4">Add Service Record</h3>
                        <p className="text-sm text-slate-500 mb-6">Log maintenance for <span className="font-bold text-slate-800">{selectedForService.name}</span>.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Service Type</label>
                                <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none">
                                    <option>Oil Change</option>
                                    <option>Tire Rotation</option>
                                    <option>Inspection</option>
                                    <option>Repair</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Current Engine Hours</label>
                                <input type="number" defaultValue={selectedForService.engineHours} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cost ($)</label>
                                <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button onClick={() => setShowServiceModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-200">Cancel</button>
                                <button onClick={handleAddService} className="flex-1 py-3 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-blue-700">Save Record</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FleetManager;
