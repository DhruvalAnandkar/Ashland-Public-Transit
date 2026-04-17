import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Phone,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Users,
  XCircle,
  User,
  UserCheck,
} from "lucide-react";
import { createRide, checkCapacity } from "../services/api";
import { calculateFare } from "../utils/fareCalculator";
import { motion, AnimatePresence } from "framer-motion";
import Toast from "./Toast";

// ---------------------------------------------------------------------------
// ANIMATION VARIANTS
// ---------------------------------------------------------------------------
const fieldVariants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const BookingForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    passengerName: "",
    phoneNumber: "",
    pickup: "",
    dropoff: "",
    userType: "Standard",
    isSameDay: false,
    passengers: 1,
    scheduledTime: "",
  });
  const [price, setPrice] = useState(2.0);
  const [capacityStatus, setCapacityStatus] = useState(null);
  const [isPast, setIsPast] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  // EXPERT: Real-Time Fleet Guard
  useEffect(() => {
    const verifyCapacity = async () => {
      if (formData.scheduledTime) {
        setChecking(true);
        setCapacityStatus(null);
        setIsFull(false);
        setIsPast(false);

        const selectedDate = new Date(formData.scheduledTime);
        const now = new Date();

        if (selectedDate < now) {
          setIsPast(true);
          setChecking(false);
          return;
        }

        try {
          const result = await checkCapacity(
            formData.scheduledTime,
            formData.passengers,
          );
          setCapacityStatus(result.isBusy ? "Busy" : "Normal");
          setIsFull(result.isFull);
        } catch (error) {
          console.error("Fleet sync failed");
        } finally {
          setChecking(false);
        }
      }
    };

    const timer = setTimeout(() => {
      verifyCapacity();
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.scheduledTime, formData.passengers]);

  // FARE ENGINE
  useEffect(() => {
    const calculatedPrice = calculateFare(
      formData.userType,
      formData.isSameDay,
      formData.passengers,
      false,
      0,
    );
    setPrice(calculatedPrice);
  }, [formData.userType, formData.isSameDay, formData.passengers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isFull || isPast || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await createRide({ ...formData, fare: price });
      navigate(`/track?ticketId=${encodeURIComponent(response.ticketId)}`);
      setFormData({
        passengerName: "",
        phoneNumber: "",
        pickup: "",
        dropoff: "",
        userType: "Standard",
        isSameDay: false,
        passengers: 1,
        scheduledTime: "",
      });
      setCapacityStatus(null);
      setIsFull(false);
      setIsPast(false);
    } catch (error) {
      addToast(
        error.response?.data?.message || "Fleet Error: Try a different time.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (e) => {
    const newTime = e.target.value;
    const date = new Date(newTime);
    const today = new Date();
    const isSameDay =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
    setFormData({ ...formData, scheduledTime: newTime, isSameDay });
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgb(0,0,0,0.14)] p-6 border border-white/30 relative overflow-hidden"
      >
        {/* DECORATIVE BLURS */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/8 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none" />

        {/* HEADER */}
        <motion.div
          custom={0}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
          className="text-center mb-8 relative z-10"
        >
          <motion.div
            whileHover={{ scale: 1.08, rotate: 3 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-blue-500/30"
          >
            <MapPin size={32} />
          </motion.div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter">
            Book a Ride
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Ashland City Transit • On-Demand
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {/* FIELD GROUP 1: Passenger Details */}
          <motion.div
            custom={1}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            <div className="relative group">
              <User
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-200"
                size={20}
              />
              <input
                type="text"
                placeholder="Full Name"
                required
                className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 bg-slate-50/80 font-bold text-sm text-slate-800 transition-all duration-200 shadow-sm hover:border-slate-300"
                value={formData.passengerName}
                onChange={(e) =>
                  setFormData({ ...formData, passengerName: e.target.value })
                }
              />
            </div>
            <div className="relative group">
              <Phone
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-200"
                size={20}
              />
              <input
                type="text"
                placeholder="Phone Number"
                required
                className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 bg-slate-50/80 font-bold text-slate-800 transition-all duration-200 shadow-sm hover:border-slate-300"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
              />
            </div>
          </motion.div>

          {/* FIELD GROUP 2: Location */}
          <motion.div
            custom={2}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3 pt-2"
          >
            <div className="relative group">
              <MapPin
                className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 transition-colors"
                size={20}
              />
              <input
                type="text"
                placeholder="Pickup Address"
                required
                className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 bg-slate-50/80 font-bold text-slate-800 transition-all duration-200 shadow-sm hover:border-slate-300"
                value={formData.pickup}
                onChange={(e) =>
                  setFormData({ ...formData, pickup: e.target.value })
                }
              />
            </div>
            <div className="relative group">
              <input
                type="text"
                placeholder="Pickup Details (e.g. Wearing Red Hat)"
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400 bg-slate-50/80 text-sm font-medium transition-all duration-200 shadow-sm hover:border-slate-300"
                value={formData.pickupDetails || ""}
                onChange={(e) =>
                  setFormData({ ...formData, pickupDetails: e.target.value })
                }
              />
            </div>
            <div className="relative group">
              <MapPin
                className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500 transition-colors"
                size={20}
              />
              <input
                type="text"
                placeholder="Drop-off Address"
                required
                className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-400 bg-slate-50/80 font-bold text-slate-800 transition-all duration-200 shadow-sm hover:border-slate-300"
                value={formData.dropoff}
                onChange={(e) =>
                  setFormData({ ...formData, dropoff: e.target.value })
                }
              />
            </div>
          </motion.div>

          {/* FIELD GROUP 3: Time & Passengers */}
          <motion.div
            custom={3}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-4 pt-2"
          >
            <div className="relative group">
              <Clock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-200"
                size={20}
              />
              <input
                type="datetime-local"
                required
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 bg-slate-50/80 font-bold text-slate-800 text-xs transition-all duration-200 shadow-sm appearance-none hover:border-slate-300"
                value={formData.scheduledTime}
                onChange={handleDateChange}
              />
            </div>
            <div className="relative group">
              <UserCheck
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-200"
                size={20}
              />
              <input
                type="number"
                min="1"
                max="10"
                placeholder="Pax"
                required
                className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 bg-slate-50/80 font-bold text-slate-800 transition-all duration-200 shadow-sm hover:border-slate-300"
                value={formData.passengers}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    passengers: parseInt(e.target.value),
                  })
                }
              />
            </div>
          </motion.div>

          {/* FIELD GROUP 4: Capacity Status */}
          <motion.div
            custom={4}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="wait">
              {checking ? (
                <motion.p
                  key="checking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] text-blue-500 font-bold animate-pulse ml-2 uppercase"
                >
                  Checking Fleet Availability...
                </motion.p>
              ) : isPast ? (
                <motion.div
                  key="past"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 bg-red-600 rounded-2xl flex items-center gap-3 text-white shadow-lg shadow-red-100"
                >
                  <Calendar size={20} />
                  <div>
                    <p className="text-xs font-black uppercase">Invalid Time</p>
                    <p className="text-[9px] opacity-90 leading-tight text-white">
                      Cannot book rides in the past. Please select a future
                      time.
                    </p>
                  </div>
                </motion.div>
              ) : isFull ? (
                <motion.div
                  key="full"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 bg-red-600 rounded-2xl flex items-center gap-3 text-white shadow-lg shadow-red-100"
                >
                  <XCircle size={20} />
                  <div>
                    <p className="text-xs font-black uppercase">
                      Fleet Fully Booked
                    </p>
                    <p className="text-[9px] opacity-90 leading-tight text-white">
                      All 7 vehicles are currently dispatched. Try a different
                      time slot.
                    </p>
                  </div>
                </motion.div>
              ) : capacityStatus === "Busy" ? (
                <motion.div
                  key="busy"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3 bg-amber-100 border border-amber-200 rounded-2xl flex items-center gap-2 text-amber-800"
                >
                  <AlertTriangle size={16} />
                  <p className="text-[10px] font-bold uppercase">
                    High Demand Window
                  </p>
                </motion.div>
              ) : formData.scheduledTime ? (
                <motion.div
                  key="clear"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-800"
                >
                  <CheckCircle2 size={16} />
                  <p className="text-[10px] font-bold uppercase">
                    Slots Available
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>

          {/* FIELD GROUP 5: User Type */}
          <motion.div
            custom={5}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
          >
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
              Passenger Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                "Standard",
                "Senior",
                "Student",
                "Veteran",
                "Elderly/Disabled",
                "Child",
              ].map((type) => (
                <motion.button
                  key={type}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setFormData({ ...formData, userType: type })}
                  className={`py-2 px-1 text-[10px] font-black rounded-xl transition-all border ${
                    formData.userType === type
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white/60 text-slate-500 border-slate-200 hover:border-blue-300"
                  }`}
                >
                  {type}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* FIELD GROUP 6: Passenger Adjuster */}
          <motion.div
            custom={6}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-between p-3 border-2 border-slate-100 rounded-2xl bg-white/60 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Users size={16} /> Group size
            </div>
            <div className="flex items-center gap-4">
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                onClick={() =>
                  setFormData({
                    ...formData,
                    passengers: Math.max(1, formData.passengers - 1),
                  })
                }
                className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-blue-600 hover:bg-blue-50 transition-colors"
              >
                -
              </motion.button>
              <span className="font-black text-sm w-4 text-center">
                {formData.passengers}
              </span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                onClick={() =>
                  setFormData({
                    ...formData,
                    passengers: formData.passengers + 1,
                  })
                }
                className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-blue-600 hover:bg-blue-50 transition-colors"
              >
                +
              </motion.button>
            </div>
          </motion.div>

          {/* FIELD GROUP 7: Fare Display */}
          <motion.div
            custom={7}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
            className="p-4 bg-blue-950 rounded-[1.5rem] flex justify-between items-center text-white shadow-xl"
          >
            <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">
              Est. Total Fare
            </span>
            <motion.span
              key={price}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="text-2xl font-black tracking-tighter"
            >
              ${price.toFixed(2)}
            </motion.span>
          </motion.div>

          {/* SUBMIT BUTTON with SHIMMER */}
          <motion.div
            custom={8}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.button
              type="submit"
              disabled={isFull || checking || isPast || isSubmitting}
              whileHover={
                !(isFull || isPast || isSubmitting) ? { scale: 1.02 } : {}
              }
              whileTap={
                !(isFull || isPast || isSubmitting) ? { scale: 0.97 } : {}
              }
              className={`relative overflow-hidden group w-full py-4 rounded-[1.5rem] font-black text-sm tracking-widest uppercase shadow-xl transition-colors
                                ${
                                  isFull || isPast || isSubmitting
                                    ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
            >
              {/* SHIMMER SWEEP — only when button is active */}
              {!(isFull || isPast || isSubmitting) && (
                <span
                  className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  aria-hidden="true"
                />
              )}
              {isFull || isPast
                ? "Unavailable"
                : checking
                  ? "Verifying..."
                  : isSubmitting
                    ? "Booking..."
                    : "Confirm Booking"}
            </motion.button>
          </motion.div>
        </form>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="text-center mt-6"
      >
        <Link
          to="/track"
          className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-widest"
        >
          Already have a ticket? Track it here
        </Link>
      </motion.div>

      {/* TOASTS */}
      <div className="fixed top-4 right-4 z-[110] flex flex-col items-end">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BookingForm;
