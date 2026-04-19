import React, { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Menu,
    X,
    LogIn,
    UserRound,
    Headphones,
    Car,
    Sun,
    Moon,
    Monitor,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import BrandLogo from "./BrandLogo";

// Compact three-way theme toggle: Light / System / Dark.
const ThemeToggle = ({ compact = false }) => {
    const { preference, setPreference } = useTheme();
    const opts = [
        { id: "light", icon: Sun, label: "Light" },
        { id: "system", icon: Monitor, label: "System" },
        { id: "dark", icon: Moon, label: "Dark" },
    ];
    return (
        <div
            role="radiogroup"
            aria-label="Theme"
            className={`inline-flex items-center rounded-full p-0.5 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 ${compact ? "gap-0" : "gap-0"
                }`}
        >
            {opts.map((o) => {
                const selected = preference === o.id;
                const Icon = o.icon;
                return (
                    <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={o.label}
                        title={`${o.label} mode`}
                        onClick={() => setPreference(o.id)}
                        className={`relative flex items-center justify-center w-7 h-7 rounded-full transition-colors ${selected
                                ? "text-blue-600 dark:text-blue-300"
                                : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                            }`}
                    >
                        {selected && (
                            <motion.span
                                layoutId={compact ? "theme-pill-m" : "theme-pill-d"}
                                className="absolute inset-0 rounded-full bg-white dark:bg-slate-900 shadow-sm"
                                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                            />
                        )}
                        <Icon size={13} strokeWidth={2.4} className="relative" />
                    </button>
                );
            })}
        </div>
    );
};

/**
 * Unified public navbar used on the landing page and all marketing pages.
 * Shows a translucent glass bar with scroll-aware elevation, a mobile
 * drawer, and role-aware actions (Staff portal or Logout).
 */
const primaryLinks = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About" },
    { to: "/services", label: "Services" },
    { to: "/fares", label: "Fares" },
    { to: "/accessibility", label: "Accessibility" },
    { to: "/faq", label: "FAQ" },
    { to: "/contact", label: "Contact" },
];

const SiteNavbar = ({ userRole, onStaffLogin, onLogout }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [staffOpen, setStaffOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 18);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        const onDocClick = () => setStaffOpen(false);
        if (staffOpen) {
            window.addEventListener("click", onDocClick);
            return () => window.removeEventListener("click", onDocClick);
        }
    }, [staffOpen]);

    return (
        <motion.header
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className={`fixed top-0 inset-x-0 z-[90] transition-all duration-300 ${scrolled
                ? "backdrop-blur-2xl bg-white/80 dark:bg-slate-950/75 border-b border-slate-200/70 dark:border-slate-800/70 shadow-[0_4px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
                : "backdrop-blur-md bg-white/40 dark:bg-slate-950/40 border-b border-white/40 dark:border-slate-800/30"
                }`}
        >
            <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between h-16">
                {/* Logo */}
                <Link to="/" className="flex items-center group" aria-label="Ashland Transit home">
                    <BrandLogo size="md" />
                </Link>

                {/* Desktop links */}
                <nav className="hidden lg:flex items-center gap-1">
                    {primaryLinks.map((l) => (
                        <NavLink
                            key={l.to}
                            to={l.to}
                            end={l.to === "/"}
                            className={({ isActive }) =>
                                `relative px-3.5 py-2 text-[13px] font-bold tracking-wide transition-colors ${isActive
                                    ? "text-blue-700 dark:text-blue-300"
                                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {l.label}
                                    {isActive && (
                                        <motion.span
                                            layoutId="nav-underline"
                                            className="absolute left-2.5 right-2.5 -bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-500"
                                        />
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Actions */}
                <div className="hidden md:flex items-center gap-2">
                    <ThemeToggle />
                    <Link
                        to="/book"
                        className="px-4 py-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-[0_8px_20px_rgba(37,99,235,0.3)] hover:shadow-[0_12px_28px_rgba(37,99,235,0.45)] transition-shadow"
                    >
                        Book a Ride
                    </Link>
                    {userRole ? (
                        <button
                            onClick={onLogout}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-widest hover:border-slate-300 dark:hover:border-slate-600"
                        >
                            <span className="flex items-center gap-1.5">
                                <UserRound size={13} /> {userRole}
                            </span>
                        </button>
                    ) : (
                        <div
                            className="relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setStaffOpen((v) => !v)}
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-widest hover:border-slate-300 dark:hover:border-slate-600 flex items-center gap-1.5"
                            >
                                <LogIn size={13} /> Staff
                                <motion.span
                                    animate={{ rotate: staffOpen ? 180 : 0 }}
                                    className="inline-block text-slate-400 dark:text-slate-500"
                                >
                                    ▾
                                </motion.span>
                            </button>
                            <AnimatePresence>
                                {staffOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                        className="absolute right-0 mt-2 w-60 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-[0_20px_50px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden"
                                    >
                                        <button
                                            onClick={() => {
                                                setStaffOpen(false);
                                                onStaffLogin?.("Dispatcher");
                                            }}
                                            className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors text-left"
                                        >
                                            <span className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                                                <Headphones size={16} />
                                            </span>
                                            <span>
                                                <span className="block text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-100">
                                                    Dispatcher
                                                </span>
                                                <span className="block text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                                    Command center + admin
                                                </span>
                                            </span>
                                        </button>
                                        <div className="h-px bg-slate-100 dark:bg-slate-800" />
                                        <button
                                            onClick={() => {
                                                setStaffOpen(false);
                                                onStaffLogin?.("Driver");
                                            }}
                                            className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors text-left"
                                        >
                                            <span className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                                                <Car size={16} />
                                            </span>
                                            <span>
                                                <span className="block text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-100">
                                                    Driver
                                                </span>
                                                <span className="block text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                                    Cab-app + navigation
                                                </span>
                                            </span>
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* Mobile toggle */}
                <div className="lg:hidden flex items-center gap-2">
                    <ThemeToggle compact />
                    <button
                        onClick={() => setMobileOpen((v) => !v)}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300"
                    >
                        {mobileOpen ? <X size={16} /> : <Menu size={16} />}
                    </button>
                </div>
            </div>

            {/* Mobile drawer */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="lg:hidden overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800"
                    >
                        <div className="px-5 py-4 space-y-1">
                            {primaryLinks.map((l) => (
                                <NavLink
                                    key={l.to}
                                    to={l.to}
                                    end={l.to === "/"}
                                    onClick={() => setMobileOpen(false)}
                                    className={({ isActive }) =>
                                        `block px-3 py-2.5 rounded-lg text-sm font-bold ${isActive
                                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                                        }`
                                    }
                                >
                                    {l.label}
                                </NavLink>
                            ))}
                            <div className="pt-2 flex gap-2">
                                <Link
                                    to="/book"
                                    onClick={() => setMobileOpen(false)}
                                    className="flex-1 text-center px-3 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs font-black uppercase tracking-widest"
                                >
                                    Book a Ride
                                </Link>
                                {userRole ? (
                                    <button
                                        onClick={() => {
                                            setMobileOpen(false);
                                            onLogout?.();
                                        }}
                                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-widest"
                                    >
                                        Logout
                                    </button>
                                ) : null}
                            </div>
                            {!userRole && (
                                <div className="pt-2 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => {
                                            setMobileOpen(false);
                                            onStaffLogin?.("Dispatcher");
                                        }}
                                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
                                    >
                                        <Headphones size={12} /> Dispatcher
                                    </button>
                                    <button
                                        onClick={() => {
                                            setMobileOpen(false);
                                            onStaffLogin?.("Driver");
                                        }}
                                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
                                    >
                                        <Car size={12} /> Driver
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
};

export default SiteNavbar;
