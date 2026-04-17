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
import {
  createRide,
  checkCapacity,
  createRideCheckoutSession,
} from "../services/api";
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
    paymentMethod: "Cash",
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

      if (formData.paymentMethod === "Stripe") {
        const checkout = await createRideCheckoutSession(response._id, {
          source: "web",
          successUrl: `${window.location.origin}/track?ticketId=${encodeURIComponent(response.ticketId)}&checkoutSessionId={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/track?ticketId=${encodeURIComponent(response.ticketId)}&paymentCancelled=true`,
        });

        if (checkout?.url) {
          window.location.href = checkout.url;
          return;
        }
      }

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
        paymentMethod: "Cash",
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
    <div className="max-w-lg mx-auto py-8 px-4">
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_48px_rgb(0,0,0,0.10)] p-7 md:p-8 border border-white/40 relative overflow-hidden"
      >
        {/* DECORATIVE BLURS */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/8 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-emerald-500/6 rounded-full blur-3xl -ml-12 -mb-12 pointer-events-none" />

        {/* HEADER */}
        <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible" className="text-center mb-8 relative z-10">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 3 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-blue-300/40"
          >
            <MapPin size={30} />
          </motion.div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Book a Ride</h2>
          <p className="text-slate-400 font-bold text-xs mt-1.5 uppercase tracking-widest">Ashland City Transit • On-Demand</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">

          {/* ── STEP 1: PASSENGER INFO ─────────────────────────────── */}
          <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-blue-600 text-white rounded-md flex items-center justify-center text-[9px] font-black">1</span>
              Passenger Info
            </p>
            <div className="space-y-3">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors duration-200" size={18} />
                <input
                  type="text" placeholder="Full Name" required
                  className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50/60 font-bold text-sm text-slate-800 transition-all shadow-sm hover:border-slate-300"
                  value={formData.passengerName}
                  onChange={(e) => setFormData({ ...formData, passengerName: e.target.value })}
                />
              </div>
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors duration-200" size={18} />
                <input
                  type="text" placeholder="Phone Number" required
                  className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50/60 font-bold text-sm text-slate-800 transition-all shadow-sm hover:border-slate-300"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
              </div>
            </div>
          </motion.div>

          {/* ── STEP 2: ROUTE ──────────────────────────────────────── */}
          <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-emerald-600 text-white rounded-md flex items-center justify-center text-[9px] font-black">2</span>
              Trip Route
            </p>
            <div className="flex gap-3">
              {/* Route connector dots */}
              <div className="flex flex-col items-center pt-4 shrink-0">
                <div className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-emerald-200 shadow-sm" />
                <div className="w-0.5 flex-1 bg-slate-200 my-1 min-h-[100px]" />
                <div className="w-3 h-3 rounded-full bg-red-400 border-2 border-red-200 shadow-sm" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="relative group">
                  <input
                    type="text" placeholder="Pickup Address" required
                    className="w-full px-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-slate-50/60 font-bold text-sm text-slate-800 transition-all shadow-sm hover:border-slate-300"
                    value={formData.pickup}
                    onChange={(e) => setFormData({ ...formData, pickup: e.target.value })}
                  />
                </div>
                <div className="relative group">
                  <input
                    type="text" placeholder="Pickup Details (e.g. Wearing Red Hat)"
                    className="w-full px-4 py-2.5 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-slate-300/40 bg-slate-50/40 text-xs font-medium text-slate-500 transition-all hover:border-slate-200"
                    value={formData.pickupDetails || ""}
                    onChange={(e) => setFormData({ ...formData, pickupDetails: e.target.value })}
                  />
                </div>
                <div className="relative group">
                  <input
                    type="text" placeholder="Drop-off Address" required
                    className="w-full px-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 bg-slate-50/60 font-bold text-sm text-slate-800 transition-all shadow-sm hover:border-slate-300"
                    value={formData.dropoff}
                    onChange={(e) => setFormData({ ...formData, dropoff: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── STEP 3: SCHEDULE ───────────────────────────────────── */}
          <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
            <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-amber-500 text-white rounded-md flex items-center justify-center text-[9px] font-black">3</span>
              Schedule
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 relative group">
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-colors" size={16} />
                <input
                  type="datetime-local" required
                  className="w-full pl-10 pr-3 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 bg-slate-50/60 font-bold text-sm text-slate-800 transition-all shadow-sm hover:border-slate-300 appearance-none"
                  value={formData.scheduledTime}
                  onChange={handleDateChange}
                />
              </div>
              <div className="relative group">
                <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                <input
                  type="number" min="1" max="10" placeholder="Pax" required
                  className="w-full pl-10 pr-2 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50/60 font-bold text-sm text-slate-800 transition-all shadow-sm hover:border-slate-300"
                  value={formData.passengers}
                  onChange={(e) => setFormData({ ...formData, passengers: parseInt(e.target.value) })}
                />
              </div>
            </div>

            {/* Capacity Status */}
            <div className="mt-3">
              <AnimatePresence mode="wait">
                {checking ? (
                  <motion.p key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] text-blue-500 font-bold animate-pulse ml-1 uppercase tracking-wider">
                    Checking Fleet Availability...
                  </motion.p>
                ) : isPast ? (
                  <motion.div key="past" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 bg-red-500 rounded-xl flex items-center gap-2.5 text-white shadow-md">
                    <Calendar size={16} />
                    <div>
                      <p className="text-[10px] font-black uppercase">Invalid Time</p>
                      <p className="text-[9px] opacity-80">Cannot book rides in the past.</p>
                    </div>
                  </motion.div>
                ) : isFull ? (
                  <motion.div key="full" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 bg-red-500 rounded-xl flex items-center gap-2.5 text-white shadow-md">
                    <XCircle size={16} />
                    <div>
                      <p className="text-[10px] font-black uppercase">Fleet Fully Booked</p>
                      <p className="text-[9px] opacity-80">Try a different time slot.</p>
                    </div>
                  </motion.div>
                ) : capacityStatus === "Busy" ? (
                  <motion.div key="busy" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-700">
                    <AlertTriangle size={14} />
                    <p className="text-[10px] font-bold uppercase">High Demand Window</p>
                  </motion.div>
                ) : formData.scheduledTime ? (
                  <motion.div key="clear" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={14} />
                    <p className="text-[10px] font-bold uppercase">Slots Available</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ── STEP 4: PASSENGER TYPE & GROUP ────────────────────── */}
          <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-indigo-600 text-white rounded-md flex items-center justify-center text-[9px] font-black">4</span>
              Passenger Type
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { type: "Standard", icon: "👤" },
                { type: "Senior", icon: "👴" },
                { type: "Student", icon: "🎓" },
                { type: "Veteran", icon: "🎖️" },
                { type: "Elderly/Disabled", icon: "♿" },
                { type: "Child", icon: "👶" },
              ].map(({ type, icon }) => (
                <motion.button
                  key={type} type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setFormData({ ...formData, userType: type })}
                  className={`py-2.5 px-2 rounded-xl transition-all border flex flex-col items-center gap-1 ${formData.userType === type
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200/50"
                      : "bg-white/70 text-slate-500 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"
                    }`}
                >
                  <span className="text-base">{icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-wider leading-none">{type}</span>
                </motion.button>
              ))}
            </div>

            {/* Group Size Adjuster */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Users size={15} className="text-slate-400" /> Group Size
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  type="button" whileTap={{ scale: 0.85 }}
                  onClick={() => setFormData({ ...formData, passengers: Math.max(1, formData.passengers - 1) })}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-black text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                >−</motion.button>
                <span className="font-black text-base w-5 text-center text-slate-800">{formData.passengers}</span>
                <motion.button
                  type="button" whileTap={{ scale: 0.85 }}
                  onClick={() => setFormData({ ...formData, passengers: formData.passengers + 1 })}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-black text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                >+</motion.button>
              </div>
            </div>
          </motion.div>

          {/* ── FARE DISPLAY ──────────────────────────────────────── */}
          <motion.div custom={5} variants={fieldVariants} initial="hidden" animate="visible"
            className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl flex justify-between items-center text-white shadow-xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.15),_transparent_50%)] pointer-events-none" />
            <div className="relative z-10">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-0.5">Estimated Total</span>
              <span className="text-[10px] font-bold text-blue-400">{formData.passengers} pax · {formData.userType}</span>
            </div>
            <motion.span
              key={price}
              initial={{ opacity: 0, scale: 0.8, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="text-3xl font-black tracking-tighter relative z-10"
            >
              ${price.toFixed(2)}
            </motion.span>
          </motion.div>

          {/* ── PAYMENT METHOD ────────────────────────────────────── */}
          <motion.div custom={6} variants={fieldVariants} initial="hidden" animate="visible">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-slate-700 text-white rounded-md flex items-center justify-center text-[9px] font-black">5</span>
              Payment
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { method: "Cash", label: "Pay Cash", icon: "💵" },
                { method: "Stripe", label: "Card (Stripe)", icon: "💳" },
              ].map(({ method, label, icon }) => (
                <motion.button
                  key={method} type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setFormData({ ...formData, paymentMethod: method })}
                  className={`py-3.5 px-3 rounded-xl transition-all border flex items-center justify-center gap-2 ${formData.paymentMethod === method
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200/40"
                      : "bg-white/70 text-slate-600 border-slate-200 hover:border-blue-300"
                    }`}
                >
                  <span className="text-base">{icon}</span>
                  <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* ── SUBMIT BUTTON ─────────────────────────────────────── */}
          <motion.div custom={7} variants={fieldVariants} initial="hidden" animate="visible">
            <motion.button
              type="submit"
              disabled={isFull || checking || isPast || isSubmitting}
              whileHover={!(isFull || isPast || isSubmitting) ? { scale: 1.02 } : {}}
              whileTap={!(isFull || isPast || isSubmitting) ? { scale: 0.97 } : {}}
              className={`relative overflow-hidden group w-full py-4 rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl transition-all ${isFull || isPast || isSubmitting
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:shadow-blue-200/50"
                }`}
            >
              {!(isFull || isPast || isSubmitting) && (
                <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden="true" />
              )}
              {isFull || isPast ? "Unavailable" : checking ? "Verifying..." : isSubmitting ? "Booking..." : formData.paymentMethod === "Stripe" ? "Continue to Payment" : "Confirm Booking"}
            </motion.button>
          </motion.div>
        </form>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.5 }} className="text-center mt-6">
        <Link to="/track" className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-widest">
          Already have a ticket? Track it here
        </Link>
      </motion.div>

      {/* TOASTS */}
      <div className="fixed top-4 right-4 z-[110] flex flex-col items-end">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BookingForm;
