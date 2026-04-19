import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  ShieldCheck,
  ArrowRight,
  Bus,
  Clock,
  Phone,
  Shield,
  Zap,
  Users,
  Navigation,
  Sparkles,
  ChevronRight,
  Globe,
  Radio,
} from "lucide-react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { getVehicles } from "../services/api";
import LeafletMap from "./LeafletMap";
import Hero3D from "./Hero3D";

// ─── TILT CARD HOOK ──────────────────────────────────────────────
const useTilt = (intensity = 15) => {
  const ref = useRef(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const onMouseMove = useCallback(
    (e) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      rotateX.set(-y * intensity);
      rotateY.set(x * intensity);
    },
    [intensity, rotateX, rotateY],
  );

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
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true);
      },
      { threshold: 0.3 },
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

  return (
    <span ref={ref} className="stat-value">
      {val}
      {suffix}
    </span>
  );
};

// ─── ANIMATED ROUTE SVG ──────────────────────────────────────────
const AnimatedRoute = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none"
    viewBox="0 0 600 400"
    preserveAspectRatio="none"
  >
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
    <circle
      cx="550"
      cy="50"
      r="6"
      fill="#ef4444"
      className="route-dot-pulse"
      style={{ animationDelay: "1s" }}
    />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════
// BUS MARQUEE — signature horizontal motion under the hero
// ═══════════════════════════════════════════════════════════════════
const BusSilhouette = ({ accent = "#3b82f6" }) => (
  <svg
    width="150"
    height="46"
    viewBox="0 0 150 46"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0"
  >
    <rect
      x="6"
      y="9"
      width="120"
      height="24"
      rx="7"
      fill="currentColor"
      className="text-slate-800"
    />
    <rect x="130" y="16" width="8" height="13" rx="3" fill={accent} opacity="0.9" />
    {/* Windows */}
    {[14, 32, 50, 68, 86, 104].map((x, i) => (
      <rect
        key={i}
        x={x}
        y="14"
        width="12"
        height="9"
        rx="1.5"
        fill={accent}
        opacity="0.85"
      />
    ))}
    {/* Stripe */}
    <rect x="6" y="27" width="120" height="1.5" fill="white" opacity="0.35" />
    {/* Wheels */}
    <circle cx="28" cy="36" r="5.5" fill="#0f172a" />
    <circle cx="28" cy="36" r="2.2" fill="#94a3b8" />
    <circle cx="102" cy="36" r="5.5" fill="#0f172a" />
    <circle cx="102" cy="36" r="2.2" fill="#94a3b8" />
  </svg>
);

const BusMarquee = () => (
  <div
    aria-hidden="true"
    className="relative mt-14 md:mt-20 overflow-hidden py-6 border-y border-slate-200/60 bg-gradient-to-r from-transparent via-white/60 to-transparent"
  >
    {/* Road line */}
    <div className="absolute inset-x-0 bottom-4 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
    {/* Dashed lane */}
    <div
      className="absolute inset-x-0 bottom-[18px] h-[2px]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, #cbd5e1 0 16px, transparent 16px 32px)",
      }}
    />

    <motion.div
      className="flex items-center gap-16 whitespace-nowrap will-change-transform"
      animate={{ x: ["0%", "-50%"] }}
      transition={{
        duration: 26,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {[...Array(12)].map((_, i) => (
        <div key={i} className="flex items-center gap-5">
          <BusSilhouette accent={i % 2 === 0 ? "#3b82f6" : "#60a5fa"} />
          <span className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-400">
            Ashland Public Transit
          </span>
          <span className="text-slate-300">•</span>
        </div>
      ))}
    </motion.div>
  </div>
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
  // Softened parallax range: -80 → -40 reduces the per-frame JS work
  // and prevents the hero from visually clipping under the nav on fast scrolls
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -40]);
  const heroScale = useTransform(scrollYProgress, [0, 0.4], [1, 0.98]);

  // Mouse parallax for hero
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springMX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springMY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const handleMouseMove = useCallback(
    (e) => {
      if (!enableMotionFx) return;
      const { clientX, clientY, currentTarget } = e;
      const { width, height, left, top } =
        currentTarget.getBoundingClientRect();
      mouseX.set(((clientX - left) / width - 0.5) * 20);
      mouseY.set(((clientY - top) / height - 0.5) * 20);
    },
    [enableMotionFx, mouseX, mouseY],
  );

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
      icon: Clock,
      title: "Real-Time GPS Tracking",
      desc: "Live sub-second GPS precision across every vehicle in the Ashland transit network. Watch your ride approach in real-time.",
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      gradient: "from-blue-500 to-blue-600",
      glow: "rgba(59,130,246,0.1)",
    },
    {
      icon: Zap,
      title: "30-Second Booking",
      desc: "Smart address autocomplete, instant fare estimation, and seamless checkout. From tap to booked in under 30 seconds.",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      gradient: "from-emerald-500 to-emerald-600",
      glow: "rgba(16,185,129,0.1)",
    },
    {
      icon: Shield,
      title: "Verified & Insured",
      desc: "Every driver is background-checked. Real-time dispatch monitoring plus 24/7 emergency support line for total peace of mind.",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
      gradient: "from-indigo-500 to-indigo-600",
      glow: "rgba(99,102,241,0.1)",
    },
  ];

  const stats = [
    {
      label: "Active Vehicles",
      value: activeCount,
      icon: Bus,
      color: "text-blue-600",
      bg: "bg-blue-50",
      glow: "shadow-blue-500/10",
    },
    {
      label: "Rides Completed",
      value: totalRides,
      icon: Navigation,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      glow: "shadow-emerald-500/10",
    },
    {
      label: "Service Zones",
      value: 12,
      icon: Globe,
      color: "text-violet-600",
      bg: "bg-violet-50",
      glow: "shadow-violet-500/10",
    },
    {
      label: "Rider Satisfaction",
      value: 98,
      suffix: "%",
      icon: Users,
      color: "text-amber-600",
      bg: "bg-amber-50",
      glow: "shadow-amber-500/10",
    },
  ];

  return (
    <div
      className="relative flex flex-col items-center overflow-x-hidden"
      onMouseMove={enableMotionFx ? handleMouseMove : undefined}
    >
      {/* ═══ AURORA BACKGROUND ═════════════════════════════════════ */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
        <div className="aurora-blob aurora-blob-4" />
        <div className="aurora-blob aurora-blob-5" />
        <div className="grid-overlay" />
      </div>

      {/* ═══ HERO — professional two-column layout ════════════════ */}
      <motion.section
        style={{ y: heroY, scale: heroScale }}
        className="relative w-full z-10 pt-6 pb-10 md:pt-10 md:pb-16"
      >
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">

          {/* ── LEFT: copy column ─────────────────────────────── */}
          <div className="lg:col-span-6 xl:col-span-6 relative z-[2]">
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 glass-panel rounded-full text-[10px] font-black uppercase tracking-[0.28em] text-slate-600 mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live · Ashland, Ohio
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="font-black leading-[1.02] tracking-[-0.02em] text-slate-900"
              style={{
                fontSize: "clamp(2.5rem, 5vw, 4.2rem)",
              }}
            >
              Public transit,{" "}
              <span className="text-gradient-hero">rebuilt for real life.</span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-6 text-base md:text-lg text-slate-500 font-medium leading-relaxed max-w-xl"
            >
              Book a ride in under a minute. Watch your bus approach on a live
              map. Travel with humans in dispatch keeping every trip on track —
              across every corner of Ashland.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="mt-8 flex gap-3 flex-wrap"
            >
              <Link to="/book">
                <motion.button
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-8 py-3.5 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white font-black text-sm rounded-2xl shadow-[0_14px_40px_rgba(37,99,235,0.35)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.5)] flex items-center gap-2 transition-shadow"
                >
                  Book a Ride <ArrowRight size={17} strokeWidth={2.5} />
                </motion.button>
              </Link>

              <Link to="/track">
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-6 py-3.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-2xl hover:border-slate-300 hover:shadow-md flex items-center gap-2 transition-all"
                >
                  <MapPin size={16} className="text-blue-600" /> Track Ride
                </motion.button>
              </Link>

              <motion.button
                onClick={handleStaffAccess}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-3.5 bg-white/70 backdrop-blur border border-slate-200 text-slate-500 font-bold text-sm rounded-2xl hover:text-slate-700 hover:border-slate-300 flex items-center gap-2 transition-all"
              >
                <ShieldCheck size={16} /> Staff Portal
              </motion.button>
            </motion.div>

            {/* Trust row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
              className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-lg"
            >
              {[
                { icon: Radio, label: "Live dispatch", sub: "Humans on deck" },
                { icon: Shield, label: "Insured fleet", sub: "City-verified" },
                { icon: Users, label: "ADA ready", sub: "Every vehicle" },
                { icon: Clock, label: "Mon–Sat", sub: "6 AM – 9 PM" },
              ].map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.95 + i * 0.06 }}
                  className="flex items-start gap-2"
                >
                  <t.icon size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider leading-tight">
                      {t.label}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      {t.sub}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* ── RIGHT: bounded 3D stage ───────────────────────── */}
          <div className="lg:col-span-6 xl:col-span-6 relative z-[1]">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="relative rounded-3xl overflow-hidden ring-1 ring-slate-900/10 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.35)] bg-slate-900"
              style={{ height: "clamp(380px, 52vw, 560px)" }}
            >
              {/* The 3D scene is fully contained inside this stage */}
              <div className="absolute inset-0">
                <Hero3D />
              </div>

              {/* Subtle edge gradient bottom to fade into body */}
              <div
                className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(5,11,24,0.6) 100%)",
                }}
              />

              {/* ─ HUD overlays pinned to the stage ─ */}
              {/* Top-left: status */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/90">
                  Live telemetry
                </span>
              </motion.div>

              {/* Top-right: Fleet */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.5 }}
                className="absolute top-4 right-4 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15"
              >
                <Bus size={14} className="text-emerald-300" />
                <div className="leading-tight">
                  <p className="text-[8px] font-black uppercase tracking-[0.22em] text-white/60">
                    Fleet
                  </p>
                  <p className="text-xs font-black text-white tracking-tight">
                    <AnimatedNum target={activeCount} />{" "}
                    <span className="text-[9px] font-semibold text-white/70">
                      active
                    </span>
                  </p>
                </div>
              </motion.div>

              {/* Bottom-left: Route card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.15, duration: 0.55 }}
                className="absolute bottom-4 left-4 w-[220px] rounded-xl bg-white/10 backdrop-blur-md border border-white/15 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-200">
                    Route ASH-04
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    On time
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 ring-[3px] ring-emerald-500/20" />
                    <span className="w-px h-5 bg-white/20" />
                    <span className="w-2 h-2 rounded-full bg-red-400 ring-[3px] ring-red-500/20" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-white truncate">
                      Claremont & Main
                    </p>
                    <p className="text-[9px] font-black text-white truncate mt-2">
                      Ashland Medical
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                    ETA
                  </span>
                  <span className="text-xs font-black text-white">
                    <AnimatedNum target={4} />{" "}
                    <span className="text-[9px] font-semibold text-white/70">
                      min
                    </span>
                  </span>
                </div>
              </motion.div>

              {/* Bottom-right: telemetry grid */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.25, duration: 0.55 }}
                className="absolute bottom-4 right-4 w-[170px] rounded-xl bg-white/10 backdrop-blur-md border border-white/15 p-2.5"
              >
                <p className="text-[8px] font-black uppercase tracking-[0.22em] text-blue-200 mb-1.5">
                  Telemetry
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { l: "Speed", v: "24 mph" },
                    { l: "GPS", v: "Lock" },
                    { l: "Stops", v: "3 left" },
                    { l: "Signal", v: "5G" },
                  ].map((k) => (
                    <div
                      key={k.l}
                      className="rounded-md bg-white/5 border border-white/10 px-2 py-1"
                    >
                      <p className="text-[7px] font-black uppercase tracking-widest text-white/60 leading-none">
                        {k.l}
                      </p>
                      <p className="text-[10px] font-black text-white mt-0.5">
                        {k.v}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* ── Horizontal scrolling bus marquee (signature motion) ── */}
        <BusMarquee />
      </motion.section>

      {/* ═══ LIVE MAP SECTION ══════════════════════════════════════ */}
      <section className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 py-16 z-10">
        <div className="text-center mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-3">
            Live map
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
            Every vehicle, <span className="text-gradient-hero">on one map</span>
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-3 max-w-lg mx-auto leading-relaxed">
            Our dispatchers watch the whole fleet in real time. You get the same
            clarity in the palm of your hand.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.2, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative perspective-1200"
        >
          <motion.div
            ref={mapTilt.ref}
            onMouseMove={mapTilt.onMouseMove}
            onMouseLeave={mapTilt.onMouseLeave}
            style={{ rotateX: mapTilt.rotateX, rotateY: mapTilt.rotateY }}
            className="tilt-card relative"
          >
            <div className="map-float-3d rounded-3xl overflow-hidden shadow-2xl shadow-blue-900/15 ring-1 ring-white/50">
              <LeafletMap className="h-[420px] w-full" />
            </div>
            <AnimatedRoute />
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0) 60%, rgba(248,250,255,0.55) 100%)",
              }}
            />
          </motion.div>

          {/* Floating fleet + systems card on map */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ amount: 0.2, margin: "-80px" }}
            transition={{ delay: 0.2, duration: 0.6 }}
            whileHover={{ scale: 1.04, y: -3 }}
            className="absolute -bottom-5 left-5 glass-panel-strong p-4 pr-5 rounded-2xl shadow-xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Bus size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                  Fleet
                </p>
                <p className="text-lg font-black text-slate-800 tracking-tight">
                  <AnimatedNum target={activeCount} />{" "}
                  <span className="text-[10px] font-bold text-slate-400">
                    active
                  </span>
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ amount: 0.2, margin: "-80px" }}
            transition={{ delay: 0.3, duration: 0.55 }}
            className="absolute -top-3 right-5 glass-panel-strong px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2"
          >
            <span className="relative flex h-2 w-2 live-dot text-emerald-500">
              <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold text-emerald-600 tracking-wide">
              Systems Online
            </span>
          </motion.div>
        </motion.div>
      </section>

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
              viewport={{ amount: 0.3, margin: "-80px" }}
              transition={{
                delay: idx * 0.1,
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
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
          viewport={{ amount: 0.2, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
            Why <span className="text-gradient-hero">Ashland Transit</span>?
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-3 max-w-md mx-auto leading-relaxed">
            Engineered for riders, dispatchers, and drivers — a complete transit
            ecosystem.
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
                viewport={{ amount: 0.3, margin: "-80px" }}
                transition={{
                  delay: idx * 0.12,
                  duration: 0.65,
                  ease: [0.22, 1, 0.36, 1],
                }}
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

                <div
                  className={`feature-line mt-5 h-1 rounded-full bg-gradient-to-r ${feature.gradient} opacity-50`}
                />
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ═══ HOW IT WORKS — scroll-linked 3-step ═══════════════════ */}
      <section className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 py-14 z-10">
        <div className="text-center mb-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
            Three taps to <span className="text-gradient-hero">your ride</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5 relative">
          {/* connecting line */}
          <div className="absolute top-[56px] left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-200 via-indigo-300 to-violet-200 hidden md:block" />
          {[
            {
              n: "01",
              title: "Book",
              text: "Pick your pickup, drop-off, and time. The app estimates your fare instantly using the official Ashland rate card.",
              tone: "from-blue-500 to-indigo-600",
              ring: "ring-blue-100",
            },
            {
              n: "02",
              title: "Track",
              text: "Dispatch assigns a driver. Your ticket lights up with the vehicle, driver name, and a live map you can follow.",
              tone: "from-indigo-500 to-violet-600",
              ring: "ring-indigo-100",
            },
            {
              n: "03",
              title: "Ride",
              text: "Meet your driver at the curb. Rate the trip, grab a receipt, and save the route for next time — all from your phone.",
              tone: "from-violet-500 to-fuchsia-600",
              ring: "ring-violet-100",
            },
          ].map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ amount: 0.3, margin: "-80px" }}
              transition={{ delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div
                className={`mx-auto w-28 h-28 rounded-3xl bg-gradient-to-br ${step.tone} text-white font-black text-3xl flex items-center justify-center shadow-[0_20px_50px_rgba(99,102,241,0.35)] ring-8 ${step.ring}`}
              >
                {step.n}
              </div>
              <div className="mt-5 text-center glass-panel-strong rounded-2xl p-5">
                <h3 className="text-lg font-black text-slate-800 mb-1.5">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  {step.text}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ LIVE OPS PREVIEW — marketing ticker ══════════════════ */}
      <section className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 py-10 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.2, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-white/70 glass-panel-strong p-8 md:p-10"
        >
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl" />

          <div className="relative grid lg:grid-cols-5 gap-8 items-center">
            <div className="lg:col-span-3">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-3 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Operations in real-time
              </p>
              <h3 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight leading-tight">
                Your ride lives on a{" "}
                <span className="text-gradient-hero">live map</span>.
              </h3>
              <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-lg">
                Dispatchers see every vehicle, every rider, and every minute.
                You see the same clarity in your pocket — ETA, driver, vehicle
                plate, and a moving dot that never stops telling the truth.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3 max-w-md">
                {[
                  { label: "GPS refresh", value: "5 s" },
                  { label: "Dispatch uptime", value: "99.9%" },
                  { label: "ETA accuracy", value: "±1 min" },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-xl border border-slate-100 bg-white/70 p-3"
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {k.label}
                    </p>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{k.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-white/80 bg-white/60 backdrop-blur-xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Live ticker
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Streaming
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    { t: "Just now", m: "Van #3 en-route to Claremont Ave" },
                    { t: "12 s ago", m: "New rider booked for 3:45 PM" },
                    { t: "41 s ago", m: "Driver Mike started shift" },
                    { t: "1 min ago", m: "Ride #ASH-4281 completed" },
                  ].map((row, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ amount: 0.2, margin: "-80px" }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white/70 border border-slate-100"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 w-16 shrink-0">
                        {row.t}
                      </span>
                      <span className="text-xs font-bold text-slate-700 truncate">
                        {row.m}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══ VOICES STRIP (subtle social proof) ════════════════════ */}
      <section className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 py-10 z-10">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              q: "My mom can book her own rides now and we can watch her get home. Peace of mind in an app.",
              a: "— Mia R., caregiver",
              tone: "from-blue-500 to-indigo-600",
            },
            {
              q: "Dispatch is finally calm. I can actually manage the fleet instead of chasing it.",
              a: "— Ops team, AshlandTransit",
              tone: "from-violet-500 to-fuchsia-600",
            },
            {
              q: "I see the rider's name, the ETA, and the route. Driving has never been this clear.",
              a: "— Marcus, Driver",
              tone: "from-emerald-500 to-teal-600",
            },
          ].map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ amount: 0.3, margin: "-80px" }}
              transition={{ delay: i * 0.08 }}
              className="glass-panel-strong rounded-2xl p-6 relative overflow-hidden"
            >
              <div
                className={`absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-20 bg-gradient-to-br ${v.tone}`}
              />
              <div className="relative">
                <span className="text-4xl font-black text-slate-300 leading-none">“</span>
                <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                  {v.q}
                </p>
                <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  {v.a}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ BOTTOM CTA ════════════════════════════════════════════ */}
      <section className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 pb-6 z-10">
        <div className="divider-glow mb-8" />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.2, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="glass-panel rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              Ready to ride?
            </h3>
            <p className="text-sm text-slate-400 font-medium mt-1">
              Book your first trip in under 30 seconds. Already have a ticket?
              Track it live.
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
