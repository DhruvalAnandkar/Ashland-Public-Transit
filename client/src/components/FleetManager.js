import React, { useState, useEffect } from "react";
import { getVehicles, updateVehicleStatus } from "../services/api";
import { Wrench } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// ANIMATION VARIANTS
// ---------------------------------------------------------------------------
const gridVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

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
    const newStatus = vehicle.status === "Active" ? "In Shop" : "Active";
    try {
      setVehicles(
        vehicles.map((v) =>
          v._id === vehicle._id ? { ...v, status: newStatus } : v,
        ),
      );
      await updateVehicleStatus(vehicle._id, newStatus);
    } catch (error) {
      alert("Failed to update status");
      loadFleet();
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    setShowServiceModal(false);
    setSelectedForService(null);
    alert("Service Record logic to be connected to backend API");
  };

  const activeCount = vehicles.filter((v) => v.status === "Active").length;
  const healthPercentage =
    Math.round((activeCount / vehicles.length) * 100) || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex justify-between items-end mb-8"
      >
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Wrench className="text-slate-600" /> Fleet Assets
          </h2>
          <p className="text-sm text-slate-500 font-bold mt-1">
            Operational Fleet: {activeCount} / {vehicles.length} Vehicles Active
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-slate-800">
            {activeCount}/{vehicles.length}
          </div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Active Units
          </div>
        </div>
      </motion.div>

      {/* HEALTH BAR */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        style={{ transformOrigin: "left" }}
        className="mb-8 bg-slate-100 rounded-full h-4 overflow-hidden"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${healthPercentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.25 }}
          className={`h-full ${
            healthPercentage > 70
              ? "bg-emerald-500"
              : healthPercentage > 40
                ? "bg-amber-500"
                : "bg-red-500"
          }`}
        />
      </motion.div>

      {/* VEHICLE GRID — staggered entrance */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={gridVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence>
          {vehicles.map((vehicle) => {
            const isActive = vehicle.status === "Active";
            const isServiceDue = (vehicle.engineHours || 0) > 5000;

            return (
              <motion.div
                key={vehicle._id}
                variants={cardVariants}
                // HOVER LIFT — translateY -4px + shadow deepens
                whileHover={{
                  y: -4,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                  transition: {
                    type: "spring",
                    stiffness: 340,
                    damping: 22,
                  },
                }}
                className={`p-6 rounded-2xl border-2 relative overflow-hidden cursor-default ${
                  isActive
                    ? "bg-white border-slate-100 shadow-sm"
                    : "bg-slate-50 border-slate-200 opacity-75"
                }`}
              >
                {/* SERVICE REQUIRED BADGE */}
                {isServiceDue && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl z-10 animate-pulse uppercase tracking-wider">
                    Service Required
                  </div>
                )}

                {/* CARD HEADER */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-black text-xl text-slate-800">
                      {vehicle.name}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase">
                      {vehicle.type}
                    </p>
                  </div>

                  {/* STATUS BADGE — with pulsing dot for Active vehicles */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                      isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {isActive ? (
                      // PULSING DOT — signals live/operational status
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                    )}
                    {vehicle.status}
                  </div>
                </div>

                {/* STATS */}
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-400 uppercase text-[10px]">
                      Capacity
                    </span>
                    <span className="font-bold text-slate-700">
                      {vehicle.capacity} Pax
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-400 uppercase text-[10px]">
                      Engine Hours
                    </span>
                    <span
                      className={`font-bold ${isServiceDue ? "text-red-600" : "text-slate-700"}`}
                    >
                      {vehicle.engineHours || 0} hrs
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-400 uppercase text-[10px]">
                      Last Service
                    </span>
                    <span className="font-bold text-slate-700">
                      {vehicle.lastServiceDate
                        ? new Date(vehicle.lastServiceDate).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    onClick={() => {
                      setSelectedForService(vehicle);
                      setShowServiceModal(true);
                    }}
                    className="px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    Service Log
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    onClick={() => toggleStatus(vehicle)}
                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors ${
                      isActive
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    }`}
                  >
                    {isActive ? "Send to Shop" : "Return to Service"}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* SERVICE MODAL */}
      <AnimatePresence>
        {showServiceModal && selectedForService && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-4">
                Add Service Record
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                Log maintenance for{" "}
                <span className="font-bold text-slate-800">
                  {selectedForService.name}
                </span>
                .
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Service Type
                  </label>
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/40">
                    <option>Oil Change</option>
                    <option>Tire Rotation</option>
                    <option>Inspection</option>
                    <option>Repair</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Current Engine Hours
                  </label>
                  <input
                    type="number"
                    defaultValue={selectedForService.engineHours}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Cost ($)
                  </label>
                  <input
                    type="number"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <div className="flex gap-4 mt-6">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowServiceModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddService}
                    className="flex-1 py-3 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Save Record
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FleetManager;
