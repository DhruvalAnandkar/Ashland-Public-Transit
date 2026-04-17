import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  ShieldCheck,
  ArrowRight,
  Bus,
  Clock,
  Phone,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import { getVehicles } from "../services/api";
import LeafletMap from "./LeafletMap";

// ---------------------------------------------------------------------------
// ANIMATION VARIANTS
// ---------------------------------------------------------------------------

// Parent container — triggers staggered children
const heroContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.13,
      delayChildren: 0.1,
    },
  },
};

// Each word in the headline fades + rises + unblurs
const heroWordVariants = {
  hidden: {
    opacity: 0,
    y: 28,
    filter: "blur(10px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// Soft fade-up for supporting text
const fadeUpVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut", delay },
  }),
};

// ---------------------------------------------------------------------------
// BACKGROUND ORB CONFIG
// Inline rgba colors — safe from Tailwind JIT purge
// ---------------------------------------------------------------------------
const ORBS = [
  {
    size: 520,
    x: "-8%",
    y: "-12%",
    color: "rgba(59, 130, 246, 0.07)", // blue-500
    duration: 10,
    delay: 0,
    keyframesX: [0, 40, -25, 10, 0],
    keyframesY: [0, -30, 20, -10, 0],
  },
  {
    size: 420,
    x: "55%",
    y: "15%",
    color: "rgba(99, 102, 241, 0.06)", // indigo-500
    duration: 13,
    delay: 1.5,
    keyframesX: [0, -35, 20, -10, 0],
    keyframesY: [0, 25, -30, 15, 0],
  },
  {
    size: 320,
    x: "20%",
    y: "55%",
    color: "rgba(16, 185, 129, 0.055)", // emerald-500
    duration: 9,
    delay: 0.8,
    keyframesX: [0, 25, -40, 15, 0],
    keyframesY: [0, -20, 35, -10, 0],
  },
  {
    size: 240,
    x: "80%",
    y: "65%",
    color: "rgba(59, 130, 246, 0.05)", // blue-500 small
    duration: 11,
    delay: 3,
    keyframesX: [0, -20, 30, -10, 0],
    keyframesY: [0, 30, -20, 10, 0],
  },
];

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------
const LandingPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [activeCount, setActiveCount] = useState(0);

  // --- Existing logic — unchanged ---
  useEffect(() => {
    const fetchFleetStatus = async () => {
      try {
        const vehicles = await getVehicles();
        const active = vehicles.filter((v) => v.status === "Active").length;
        setActiveCount(active);
      } catch (err) {
        console.error("Failed to load fleet status");
      }
    };
    fetchFleetStatus();
  }, []);

  const handleStaffAccess = (e) => {
    e.preventDefault();
    const success = onLogin();
    if (success) {
      navigate("/dashboard");
    }
  };

  return (
    /*
     * Outer wrapper is `relative overflow-hidden` so the absolute-positioned
     * background layer is clipped to this section and doesn't bleed into the
     * nav or footer (which are rendered by App.js outside this component).
     */
    <div className="relative flex flex-col items-center justify-center space-y-12 py-8 md:py-16 overflow-hidden">
      {/* ================================================================
                ANIMATED BACKGROUND LAYER — pointer-events-none, z-0
                ================================================================ */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
        style={{ zIndex: 0 }}
      >
        {/* DOT GRID + VIGNETTE OVERLAY — pure CSS, no new library, no new elements.
            Two background layers on one div:
            1. Vignette: transparent at center → rgba(0,0,0,0.15) at edges
               so the orbs appear to glow outward from the page center.
            2. Dot grid: repeating 28px radial dots in brand blue. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.15) 100%)",
              "radial-gradient(circle, rgba(30, 64, 175, 0.15) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "100% 100%, 28px 28px",
          }}
        />

        {/* FLOATING ORBS */}
        {ORBS.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: orb.size,
              height: orb.size,
              left: orb.x,
              top: orb.y,
              backgroundColor: orb.color,
              filter: "blur(72px)",
              willChange: "transform",
            }}
            animate={{
              x: orb.keyframesX,
              y: orb.keyframesY,
              scale: [1, 1.06, 0.96, 1.04, 1],
            }}
            transition={{
              duration: orb.duration,
              delay: orb.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* ================================================================
                HERO SECTION
                ================================================================ */}
      <div
        className="grid md:grid-cols-2 gap-8 max-w-5xl w-full items-center px-4"
        style={{ position: "relative", zIndex: 1 }}
      >
        {/* ---- TEXT CONTENT ---- */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="text-left space-y-6"
        >
          {/* Live badge — unchanged */}
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider mb-2"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Live Transit System
          </motion.div>

          {/*
           * STAGGERED WORD-BY-WORD HEADLINE
           * Each word is a motion.span that animates independently.
           * "Ashland" → normal slate, "Transit" → blue-600 (unchanged brand color).
           */}
          <motion.h1
            className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter leading-tight relative z-10"
            variants={heroContainerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.span
              variants={heroWordVariants}
              className="inline-block mr-3"
            >
              Ashland
            </motion.span>
            <motion.span
              variants={heroWordVariants}
              className="inline-block text-blue-600"
            >
              Transit
            </motion.span>
          </motion.h1>

          {/* Subheading — delayed fade-up */}
          <motion.p
            custom={0.55}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="text-base text-slate-600 font-medium leading-relaxed max-w-md"
          >
            The smart, reliable, and accessible way to move around our city.
            Book rides instantly and track in real-time.
          </motion.p>

          {/* CTA BUTTONS */}
          <motion.div
            custom={0.7}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="flex gap-4 pt-2 flex-wrap"
          >
            {/*
             * PRIMARY CTA — breathing float loop + shimmer sweep on hover.
             * The shimmer is a pure-CSS span that slides across on group-hover.
             * Framer Motion handles scale + float; CSS handles the shimmer.
             */}
            <Link to="/book">
              <motion.button
                // Idle breathing — gently floats up and down
                animate={{ y: [0, -4, 0] }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                // Hover overrides the float, adds scale
                whileHover={{ scale: 1.07, y: -2 }}
                whileTap={{ scale: 0.95, y: 0 }}
                className="relative overflow-hidden group px-8 py-3 bg-blue-600 text-white font-black text-sm rounded-xl shadow-lg shadow-blue-500/30 flex items-center gap-2 hover:bg-blue-700 transition-colors"
              >
                {/* SHIMMER SWEEP — CSS only, no JS */}
                <span
                  className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  aria-hidden="true"
                />
                Book a Ride <ArrowRight size={18} />
              </motion.button>
            </Link>

            {/* SECONDARY CTA — gentle hover scale */}
            <Link to="/track">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-white/50 backdrop-blur-sm border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-white hover:border-blue-200 transition-all flex items-center gap-2"
              >
                <MapPin size={18} className="text-blue-500" /> Track Ride
              </motion.button>
            </Link>

            {/* STAFF BUTTON — hover scale, unchanged onClick */}
            <motion.button
              onClick={handleStaffAccess}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <ShieldCheck size={18} /> Staff
            </motion.button>
          </motion.div>
        </motion.div>

        {/* ---- MAP VISUAL (right column) — unchanged layout ---- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative hidden md:block"
        >
          <LeafletMap className="h-64 w-full shadow-2xl shadow-blue-900/10 rotate-1 hover:rotate-0 transition-all duration-500" />

          {/* FLOATING STATS CARD — delayed entrance */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: 0.85,
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
            // Subtle perpetual float so it feels live
            whileHover={{ scale: 1.04 }}
            className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-4 cursor-default"
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"
            >
              <Bus size={20} />
            </motion.div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">
                Active Fleet
              </p>
              <p className="text-xl font-black text-slate-800">
                {activeCount} Vehicles
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ================================================================
                FEATURES GRID — staggered entrance + hover lift
                ================================================================ */}
      <div
        className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4 w-full pt-8"
        style={{ position: "relative", zIndex: 1 }}
      >
        {[
          {
            icon: Clock,
            title: "Real-Time Tracking",
            desc: "Live GPS updates.",
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            icon: Phone,
            title: "Easy Booking",
            desc: "Book online or via phone.",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            icon: Shield,
            title: "Safe & Reliable",
            desc: "Verified drivers & support.",
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
        ].map((feature, idx) => (
          <motion.div
            key={idx}
            // Entrance
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.45 + idx * 0.1,
              duration: 0.5,
              ease: "easeOut",
            }}
            // Hover lift — translateY and shadow deepen
            whileHover={{
              y: -6,
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.09)",
              transition: { type: "spring", stiffness: 320, damping: 22 },
            }}
            className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-slate-100 shadow-sm cursor-default"
          >
            {/* Icon with a spring pop on hover */}
            <motion.div
              whileHover={{
                scale: 1.15,
                rotate: 6,
                transition: { type: "spring", stiffness: 400, damping: 18 },
              }}
              className={`w-10 h-10 ${feature.bg} ${feature.color} rounded-xl flex items-center justify-center mb-4`}
            >
              <feature.icon size={20} />
            </motion.div>
            <h3 className="text-lg font-black text-slate-800 mb-1">
              {feature.title}
            </h3>
            <p className="text-sm text-slate-500 font-medium">{feature.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* ================================================================
                BOTTOM LINK
                ================================================================ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.6 }}
        style={{ position: "relative", zIndex: 1 }}
      >
        <Link
          to="/track"
          className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-widest"
        >
          Already have a ticket? Track here
        </Link>
      </motion.div>
    </div>
  );
};

export default LandingPage;
