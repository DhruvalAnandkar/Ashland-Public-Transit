import React, { useState, useEffect } from "react";
import {
  getVehicles,
  updateVehicleStatus,
  createVehicle,
  deleteVehicle,
  addVehicleServiceLog,
  getDrivers,
  updateVehicleDriver,
} from "../services/api";
import { Wrench, Plus, Trash2, UserCheck, ClipboardList } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Toast from "./Toast";

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

const emptyVehicle = {
  name: "",
  type: "Small Car",
  capacity: 4,
  licensePlate: "",
  status: "Active",
};

const FleetManager = () => {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Modals
  const [serviceFor, setServiceFor] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    type: "Oil Change",
    cost: "",
    mileage: "",
    notes: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyVehicle);
  const [historyFor, setHistoryFor] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);

  const addToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
  };
  const removeToast = (id) => setToasts((p) => p.filter((t) => t.id !== id));

  const loadFleet = async () => {
    try {
      const [veh, drv] = await Promise.all([getVehicles(), getDrivers()]);
      setVehicles(veh);
      setDrivers(drv || []);
    } catch {
      addToast("Failed to load fleet", "error");
    }
  };

  useEffect(() => {
    loadFleet();
  }, []);

  const toggleStatus = async (vehicle) => {
    const newStatus = vehicle.status === "Active" ? "In Shop" : "Active";
    setVehicles((vs) =>
      vs.map((v) => (v._id === vehicle._id ? { ...v, status: newStatus } : v)),
    );
    try {
      await updateVehicleStatus(vehicle._id, newStatus);
      addToast(`${vehicle.name} → ${newStatus}`, "success");
    } catch {
      addToast("Failed to update status", "error");
      loadFleet();
    }
  };

  const assignDriver = async (vehicle, driverUsername) => {
    try {
      await updateVehicleDriver(vehicle._id, driverUsername || null);
      addToast(
        driverUsername
          ? `Assigned ${driverUsername} → ${vehicle.name}`
          : `Unassigned driver from ${vehicle.name}`,
        "success",
      );
      loadFleet();
    } catch {
      addToast("Driver assignment failed", "error");
    }
  };

  const submitService = async (e) => {
    e.preventDefault();
    if (!serviceFor) return;
    try {
      await addVehicleServiceLog(serviceFor._id, serviceForm);
      addToast(`Service logged for ${serviceFor.name}`, "success");
      setServiceFor(null);
      setServiceForm({ type: "Oil Change", cost: "", mileage: "", notes: "" });
      loadFleet();
    } catch (err) {
      addToast(
        `Service save failed: ${err.response?.data?.message || err.message}`,
        "error",
      );
    }
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    try {
      await createVehicle(createForm);
      addToast(`Vehicle ${createForm.name} added`, "success");
      setCreateOpen(false);
      setCreateForm(emptyVehicle);
      loadFleet();
    } catch (err) {
      addToast(
        `Create failed: ${err.response?.data?.message || err.message}`,
        "error",
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleteFor) return;
    try {
      await deleteVehicle(deleteFor._id);
      addToast(`Vehicle ${deleteFor.name} removed`, "success");
      setDeleteFor(null);
      loadFleet();
    } catch (err) {
      addToast(
        `Delete failed: ${err.response?.data?.message || err.message}`,
        "error",
      );
    }
  };

  const activeCount = vehicles.filter((v) => v.status === "Active").length;
  const healthPercentage =
    Math.round((activeCount / Math.max(1, vehicles.length)) * 100) || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Toasts */}
      <div className="fixed top-5 right-5 z-[200] space-y-2">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onClose={() => removeToast(t.id)}
          />
        ))}
      </div>

      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex justify-between items-end mb-6 gap-4 flex-wrap"
      >
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Wrench className="text-slate-600" /> Fleet Assets
          </h2>
          <p className="text-sm text-slate-500 font-bold mt-1">
            Operational Fleet: {activeCount} / {vehicles.length} Vehicles Active
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-3xl font-black text-slate-800">
              {activeCount}/{vehicles.length}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Active Units
            </div>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow"
          >
            <Plus size={14} /> Add vehicle
          </button>
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

      {/* GRID */}
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
            const historyCount = vehicle.maintenanceHistory?.length || 0;

            return (
              <motion.div
                key={vehicle._id}
                variants={cardVariants}
                whileHover={{
                  y: -4,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                  transition: { type: "spring", stiffness: 340, damping: 22 },
                }}
                className={`p-6 rounded-2xl border-2 relative overflow-hidden ${
                  isActive
                    ? "bg-white border-slate-100 shadow-sm"
                    : "bg-slate-50 border-slate-200 opacity-80"
                }`}
              >
                {isServiceDue && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl z-10 animate-pulse uppercase tracking-wider">
                    Service Required
                  </div>
                )}

                {/* HEADER */}
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="font-black text-xl text-slate-800">
                      {vehicle.name}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase">
                      {vehicle.type}
                      {vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ""}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                      isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : vehicle.status === "Retired"
                          ? "bg-slate-200 text-slate-600"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {isActive ? (
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
                <div className="space-y-3 mb-4 text-sm">
                  <Row label="Capacity" value={`${vehicle.capacity} Pax`} />
                  <Row
                    label="Engine hours"
                    value={`${vehicle.engineHours || 0} hrs`}
                    highlight={isServiceDue ? "text-red-600" : undefined}
                  />
                  <Row
                    label="Last service"
                    value={
                      vehicle.lastServiceDate
                        ? new Date(vehicle.lastServiceDate).toLocaleDateString()
                        : "N/A"
                    }
                  />
                  <Row
                    label="Service records"
                    value={historyCount ? `${historyCount} logged` : "None"}
                  />
                </div>

                {/* DRIVER ASSIGNMENT */}
                <div className="mb-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
                    <UserCheck size={10} /> Driver
                  </label>
                  <select
                    value={vehicle.assignedDriver || ""}
                    onChange={(e) => assignDriver(vehicle, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="">— Unassigned —</option>
                    {drivers.map((d) => (
                      <option key={d._id} value={d.username}>
                        {d.username}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ACTIONS */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setServiceFor(vehicle)}
                    className="px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Wrench size={12} /> Log service
                  </button>
                  <button
                    onClick={() => setHistoryFor(vehicle)}
                    className="px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ClipboardList size={12} /> History
                  </button>
                  <button
                    onClick={() => toggleStatus(vehicle)}
                    className={`col-span-2 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors ${
                      isActive
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {isActive ? "Send to shop" : "Return to service"}
                  </button>
                  <button
                    onClick={() => setDeleteFor(vehicle)}
                    className="col-span-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={12} /> Remove from fleet
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* ──────────────────── SERVICE LOG MODAL ──────────────────── */}
      <AnimatePresence>
        {serviceFor && (
          <ModalShell onClose={() => setServiceFor(null)}>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">
              Log service
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              For{" "}
              <span className="font-bold text-slate-800">
                {serviceFor.name}
              </span>
            </p>
            <form onSubmit={submitService} className="space-y-3">
              <Field label="Service type">
                <select
                  value={serviceForm.type}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, type: e.target.value })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {[
                    "Oil Change",
                    "Tire Rotation",
                    "Inspection",
                    "Repair",
                    "Cleaning",
                    "Brake Service",
                    "Transmission",
                    "Annual DOT",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cost ($)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={serviceForm.cost}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, cost: e.target.value })
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </Field>
                <Field label="Mileage">
                  <input
                    type="number"
                    min="0"
                    value={serviceForm.mileage}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        mileage: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </Field>
              </div>
              <Field label="Notes">
                <textarea
                  rows={3}
                  value={serviceForm.notes}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, notes: e.target.value })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="Details, mechanic, findings…"
                />
              </Field>
              <ModalFooter
                onCancel={() => setServiceFor(null)}
                saveLabel="Save record"
              />
            </form>
          </ModalShell>
        )}

        {/* ──────────────── CREATE VEHICLE MODAL ──────────────── */}
        {createOpen && (
          <ModalShell onClose={() => setCreateOpen(false)}>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-5">
              Add vehicle
            </h3>
            <form onSubmit={submitCreate} className="space-y-3">
              <Field label="Name">
                <input
                  required
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, type: e.target.value })
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none"
                  >
                    <option>Small Car</option>
                    <option>Large Van</option>
                  </select>
                </Field>
                <Field label="Capacity">
                  <input
                    type="number"
                    min="1"
                    required
                    value={createForm.capacity}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        capacity: Number(e.target.value),
                      })
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none"
                  />
                </Field>
              </div>
              <Field label="License plate">
                <input
                  value={createForm.licensePlate}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      licensePlate: e.target.value,
                    })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none"
                />
              </Field>
              <ModalFooter
                onCancel={() => setCreateOpen(false)}
                saveLabel="Create vehicle"
                color="emerald"
              />
            </form>
          </ModalShell>
        )}

        {/* ──────────────── HISTORY MODAL ──────────────── */}
        {historyFor && (
          <ModalShell onClose={() => setHistoryFor(null)}>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">
              Service history
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-bold text-slate-800">
                {historyFor.name}
              </span>
            </p>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {(historyFor.maintenanceHistory || []).length === 0 && (
                <p className="p-6 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                  No service records yet
                </p>
              )}
              {(historyFor.maintenanceHistory || [])
                .slice()
                .reverse()
                .map((h, i) => (
                  <div key={i} className="p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-800">
                        {h.type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(h.date).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex gap-3 flex-wrap">
                      {h.cost > 0 && <span>${Number(h.cost).toFixed(2)}</span>}
                      {h.mileage > 0 && <span>{h.mileage} mi</span>}
                      {h.performedBy && <span>by {h.performedBy}</span>}
                    </div>
                    {h.notes && (
                      <p className="text-xs text-slate-600 mt-1">{h.notes}</p>
                    )}
                  </div>
                ))}
            </div>
          </ModalShell>
        )}

        {/* ──────────────── DELETE CONFIRM ──────────────── */}
        {deleteFor && (
          <ModalShell onClose={() => setDeleteFor(null)}>
            <h3 className="text-xl font-black text-red-600 uppercase tracking-tight mb-1">
              Remove vehicle?
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              This will permanently remove{" "}
              <b>{deleteFor.name}</b> from the fleet. Ride history is retained.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteFor(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-xs rounded-xl"
              >
                Delete
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
};

const Row = ({ label, value, highlight }) => (
  <div className="flex justify-between items-center">
    <span className="font-bold text-slate-400 uppercase text-[10px]">
      {label}
    </span>
    <span className={`font-bold ${highlight || "text-slate-700"}`}>
      {value}
    </span>
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
      {label}
    </label>
    {children}
  </div>
);

const ModalShell = ({ children, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose?.();
    }}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 20 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
    >
      {children}
    </motion.div>
  </motion.div>
);

const ModalFooter = ({ onCancel, saveLabel, color = "blue" }) => (
  <div className="flex gap-3 mt-5">
    <button
      type="button"
      onClick={onCancel}
      className="flex-1 py-3 bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-200"
    >
      Cancel
    </button>
    <button
      type="submit"
      className={`flex-1 py-3 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-colors ${
        color === "emerald"
          ? "bg-emerald-600 hover:bg-emerald-500"
          : "bg-blue-600 hover:bg-blue-500"
      }`}
    >
      {saveLabel}
    </button>
  </div>
);

export default FleetManager;
