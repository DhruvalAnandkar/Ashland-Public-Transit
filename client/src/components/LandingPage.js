import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin, ShieldCheck, ArrowRight, Bus, Clock,
  Phone, Shield, Zap, Users, Navigation, Sparkles,
  ChevronRight, Globe, Radio,
} from "lucide-react";
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { getVehicles } from "../services/api";
import LeafletMap from "./LeafletMap";

// ─── TILT CARD HOOK ──────────────────────────────────────────────
const useTilt = (intensity = 15) => {
  const ref = useRef(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const onMouseMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(-y * intensity);
    rotateY.set(x * intensity);
  }, [intensity, rotateX, rotateY]);

  const onMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return { ref, rotateX: springX, rotateY: springY, onMouseMove, onMouseLeave };
};

// ─── ANIMATED COUNTER ────────────────────────────────────────────
const AnimatedNum = ({ target, suffix = "", duration = 1.8 }) => {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || target === 0) return;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setVal(Math.floor(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, target, duration]);

  return <span ref={ref} className="stat-value">{val}{suffix}</span>;
};

// ─── TRANSIT VEHICLE SVG ─────────────────────────────────────────
const TransitBusSVG = () => (
  <svg width="80" height="40" viewBox="0 0 80 40" fill="none" className="transit-vehicle">
    <rect x="5" y="8" width="65" height="22" rx="6" fill="#2563eb" />
    <rect x="8" y="12" width="10" height="8" rx="2" fill="rgba(255,255,255,0.85)" />
    <rect x="22" y="12" width="10" height="8" rx="2" fill="rgba(255,255,255,0.85)" />
    <rect x="36" y="12" width="10" height="8" rx="2" fill="rgba(255,255,255,0.85)" />
    <rect x="50" y="12" width="14" height="14" rx="2" fill="rgba(255,255,255,0.6)" />
    <circle cx="20" cy="32" r="5" fill="#1e293b" />
    <circle cx="20" cy="32" r="2.5" fill="#94a3b8" />
    <circle cx="55" cy="32" r="5" fill="#1e293b" />
    <circle cx="55" cy="32" r="2.5" fill="#94a3b8" />
    <rect x="68" y="14" width="4" height="6" rx="1" fill="#f59e0b" />
    <rect x="3" y="14" width="4" height="6" rx="1" fill="#ef4444" />
  </svg>
);

// ─── ANIMATED ROUTE SVG ──────────────────────────────────────────
const AnimatedRoute = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 400" preserveAspectRatio="none">
    <defs>
      <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
        <stop offset="50%" stopColor="#2563eb" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.2" />
      </linearGradient>
    </defs>
    <path
      d="M 50 350 C 100 280, 150 200, 200 220 S 300 150, 350 180 S 450 80, 550 50"
      stroke="url(#routeGrad)"
      strokeWidth="2.5"
      fill="none"
      className="route-path"
      strokeLinecap="round"
    />
    <circle cx="50" cy="350" r="6" fill="#22c55e" className="route-dot-pulse" />
    <circle cx="550" cy="50" r="6" fill="#ef4444" className="route-dot-pulse" style={{ animationDelay: "1s" }} />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════
const LandingPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [activeCount, setActiveCount] = useState(0);
  const [totalRides, setTotalRides] = useState(0);
  const [enableMotionFx, setEnableMotionFx] = useState(false);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.4], [0, -80]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.97]);

  // Mouse parallax for hero
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springMX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springMY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const handleMouseMove = useCallback((e) => {
    if (!enableMotionFx) return;
    const { clientX, clientY, currentTarget } = e;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(((clientX - left) / width - 0.5) * 20);
    mouseY.set(((clientY - top) / height - 0.5) * 20);
  }, [enableMotionFx, mouseX, mouseY]);

  // 3D tilt for map
  const mapTilt = useTilt(8);
  // 3D tilt for feature cards
  const tilt1 = useTilt(12);
  const tilt2 = useTilt(12);
  const tilt3 = useTilt(12);
  const tilts = [tilt1, tilt2, tilt3];

  useEffect(() => {
    const fetchFleetStatus = async () => {
      try {
        const vehicles = await getVehicles();
        setActiveCount(vehicles.filter((v) => v.status === "Active").length);
        setTotalRides(Math.floor(Math.random() * 200 + 850));
      } catch {
        setActiveCount(7);
        setTotalRides(1024);
      }
    };
    fetchFleetStatus();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnableMotionFx(mq.matches && !rm.matches);
    update();
    mq.addEventListener("change", update);
    rm.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
      rm.removeEventListener("change", update);
    };
  }, []);

  const handleStaffAccess = (e) => {
    e.preventDefault();
    onLogin();
  };

  const features = [
    {
      icon: Clock, title: "Real-Time GPS Tracking",
      desc: "Live sub-second GPS precision across every vehicle in the Ashland transit network. Watch your ride approach in real-time.",
      color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100",
      gradient: "from-blue-500 to-blue-600", glow: "rgba(59,130,246,0.1)",
    },
    {
      icon: Zap, title: "30-Second Booking",
      desc: "Smart address autocomplete, instant fare estimation, and seamless checkout. From tap to booked in under 30 seconds.",
      color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
      gradient: "from-emerald-500 to-emerald-600", glow: "rgba(16,185,129,0.1)",
    },
    {
      icon: Shield, title: "Verified & Insured",
      desc: "Every driver is background-checked. Real-time dispatch monitoring plus 24/7 emergency support line for total peace of mind.",
      color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100",
      gradient: "from-indigo-500 to-indigo-600", glow: "rgba(99,102,241,0.1)",
    },
  ];

  const stats = [
    { label: "Active Vehicles", value: activeCount, icon: Bus, color: "text-blue-600", bg: "bg-blue-50", glow: "shadow-blue-500/10" },
    { label: "Rides Completed", value: totalRides, icon: Navigation, color: "text-emerald-600", bg: "bg-emerald-50", glow: "shadow-emerald-500/10" },
    { label: "Service Zones", value: 12, icon: Globe, color: "text-violet-600", bg: "bg-violet-50", glow: "shadow-violet-500/10" },
    { label: "Rider Satisfaction", value: 98, suffix: "%", icon: Users, color: "text-amber-600", bg: "bg-amber-50", glow: "shadow-amber-500/10" },
  ];

  return (
    <div className="relative flex flex-col items-center overflow-hidden" onMouseMove={enableMotionFx ? handleMouseMove : undefined}>
      {/* ═══ AURORA BACKGROUND ═════════════════════════════════════ */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
        <div className="aurora-blob aurora-blob-4" />
        <div className="aurora-blob aurora-blob-5" />
        <div className="grid-overlay" />
      </div>

      {/* ═══ ANIMATED TRANSIT VEHICLE ══════════════════════════════ */}
      <div className="fixed bottom-8 left-0 w-full z-10 pointer-events-none opacity-25">
        <TransitBusSVG />
      </div>

      {/* ═══ HERO SECTION ══════════════════════════════════════════ */}
      <motion.section
        style={{ y: heroY, scale: heroScale }}
        className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 pt-4 pb-6 md:pt-10 md:pb-12 z-10"
      >
        <div className="grid md:grid-cols-5 gap-10 lg:gap-14 items-center">
          {/* ── Left Column (3/5) ─────────────────────────────── */}
          <div className="md:col-span-3 space-y-7">
            {/* Live Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="badge-float inline-flex items-center gap-2.5 px-5 py-2.5 glass-panel rounded-full text-xs font-bold uppercase tracking-widest text-blue-600">
                <span className="relative flex h-2.5 w-2.5 live-dot text-blue-500">
                  <span className="inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                </span>
                Live Transit System
                <Sparkles size={14} className="text-blue-400" />
              </div>
            </motion.div>

            {/* Hero Headline — 3D animated gradient */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="perspective-800"
            >
              <motion.h1
                initial={{ rotateX: 30, y: 40, opacity: 0 }}
                animate={{ rotateX: 0, y: 0, opacity: 1 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight"
                style={{ transformStyle: "preserve-3d" }}
              >
                <motion.span
                  style={enableMotionFx ? { x: springMX, y: springMY } : undefined}
                  className="inline-block text-slate-800"
                >
                  Ashland
                </motion.span>
                <br />
                <span className="text-gradient-hero">Transit</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
                className="text-xl md:text-2xl font-extrabold text-slate-500 mt-2 tracking-tight"
              >
                Command Center
              </motion.p>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="text-base md:text-lg text-slate-500 font-medium leading-relaxed max-w-xl"
            >
              The smart, reliable, and accessible way to move around Ashland.
              Book rides in seconds, track in real-time, travel with total confidence.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65 }}
              className="flex gap-3 flex-wrap"
            >
              <Link to="/book">
                <motion.button
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.96 }}
                  className="cta-primary px-9 py-4 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-600/20 flex items-center gap-2.5 transition-all"
                >
                  Book a Ride <ArrowRight size={18} strokeWidth={2.5} />
                </motion.button>
              </Link>

              <Link to="/track">
                <motion.button
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  className="glass-panel px-7 py-4 text-slate-600 font-bold text-sm rounded-2xl hover:shadow-xl transition-all flex items-center gap-2"
                >
                  <MapPin size={18} className="text-blue-500" />
                  Track Ride
                </motion.button>
              </Link>

              <motion.button
                onClick={handleStaffAccess}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.96 }}
                className="glass-panel px-7 py-4 text-slate-400 font-bold text-sm rounded-2xl hover:shadow-xl hover:text-slate-600 transition-all flex items-center gap-2"
              >
                <ShieldCheck size={18} /> Staff Portal
              </motion.button>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="flex items-center gap-5 pt-2"
            >
              {[
                { icon: Radio, text: "24/7 Dispatch" },
                { icon: Shield, text: "Fully Insured" },
                { icon: Users, text: "ADA Accessible" },
              ].map((badge, i) => (
                <div key={i} className="flex items-center gap-1.5 text-slate-400">
                  <badge.icon size={14} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">{badge.text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right Column (2/5) — Map ──────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 40, rotateY: -10 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-2 relative hidden md:block perspective-1200"
          >
            <motion.div
              ref={mapTilt.ref}
              onMouseMove={mapTilt.onMouseMove}
              onMouseLeave={mapTilt.onMouseLeave}
              style={{ rotateX: mapTilt.rotateX, rotateY: mapTilt.rotateY }}
              className="tilt-card relative"
            >
              <div className="map-float-3d rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/15 ring-1 ring-white/50">
                <LeafletMap className="h-80 w-full" />
              </div>

              {/* Animated Route Overlay */}
              <AnimatedRoute />

              {/* Gradient overlay for depth */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0) 60%, rgba(248,250,255,0.6) 100%)",
                }}
              />
            </motion.div>

            {/* Floating Fleet Card */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.06, y: -4 }}
              className="absolute -bottom-4 -left-4 glass-panel-strong p-4 pr-6 rounded-2xl shadow-xl cursor-default"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"
                >
                  <Bus size={20} />
                </motion.div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Fleet</p>
                  <p className="text-xl font-black text-slate-800 tracking-tight">
                    <AnimatedNum target={activeCount} /> <span className="text-xs font-bold text-slate-400">active</span>
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Status Pill */}
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 1.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute -top-3 -right-3 glass-panel-strong px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2"
            >
              <span className="relative flex h-2 w-2 live-dot text-emerald-500">
                <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold text-emerald-600 tracking-wide">Systems Online</span>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="hidden md:flex justify-center mt-10"
        >
          <div className="scroll-mouse" />
        </motion.div>
      </motion.section>

      {/* ═══ DIVIDER ═══════════════════════════════════════════════ */}
      <div className="w-full max-w-5xl mx-auto px-8 z-10">
        <div className="divider-glow" />
      </div>

      {/* ═══ STATS BAR ═════════════════════════════════════════════ */}
      <section className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 py-10 z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: idx * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6, scale: 1.03 }}
              className={`glass-panel-strong rounded-2xl p-6 text-center cursor-default shadow-lg ${stat.glow}`}
            >
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className={`mx-auto w-11 h-11 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-3`}
              >
                <stat.icon size={20} />
              </motion.div>
              <p className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
                <AnimatedNum target={stat.value} suffix={stat.suffix || ""} />
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ══════════════════════════════════════════════ */}
      <section className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 pb-10 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
            Why <span className="text-gradient-hero">Ashland Transit</span>?
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-3 max-w-md mx-auto leading-relaxed">
            Engineered for riders, dispatchers, and drivers — a complete transit ecosystem.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5 perspective-1200">
          {features.map((feature, idx) => {
            const tilt = tilts[idx];
            return (
              <motion.div
                key={idx}
                ref={tilt.ref}
                onMouseMove={tilt.onMouseMove}
                onMouseLeave={tilt.onMouseLeave}
                style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: idx * 0.12, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className={`feature-card glass-panel-strong p-7 rounded-2xl border ${feature.border} cursor-default`}
              >
                <div
                  className={`feature-icon-wrap w-14 h-14 ${feature.bg} ${feature.color} rounded-2xl flex items-center justify-center mb-5`}
                  style={{ boxShadow: `0 4px 20px ${feature.glow}` }}
                >
                  <feature.icon size={24} />
                </div>

                <h3 className="text-lg font-black text-slate-800 mb-2 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  {feature.desc}
                </p>

                <div className={`feature-line mt-5 h-1 rounded-full bg-gradient-to-r ${feature.gradient} opacity-50`} />
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ═══ BOTTOM CTA ════════════════════════════════════════════ */}
      <section className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 pb-6 z-10">
        <div className="divider-glow mb-8" />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="glass-panel rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              Ready to ride?
            </h3>
            <p className="text-sm text-slate-400 font-medium mt-1">
              Book your first trip in under 30 seconds. Already have a ticket? Track it live.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link to="/book">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                className="px-7 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                Book Now <ChevronRight size={16} />
              </motion.button>
            </Link>
            <Link to="/track">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                className="px-7 py-3 bg-white border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:border-blue-200 transition-colors flex items-center gap-2"
              >
                <MapPin size={16} className="text-blue-500" /> Track Ticket
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
};

export default LandingPage;
