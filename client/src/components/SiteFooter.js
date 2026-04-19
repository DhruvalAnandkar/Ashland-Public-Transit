import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Bus,
    Mail,
    Phone,
    MapPin,
    Clock,
    ArrowRight,
    Github,
} from "lucide-react";

const SiteFooter = () => {
    return (
        <footer className="relative mt-20 text-slate-600">
            {/* Top wave / gradient bleed */}
            <div
                className="h-20"
                style={{
                    background:
                        "linear-gradient(180deg, transparent 0%, rgba(224,231,255,0.5) 100%)",
                }}
            />
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-slate-300">
                <div className="max-w-7xl mx-auto px-6 sm:px-8 py-14">
                    <div className="grid md:grid-cols-5 gap-10">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-4">
                                <motion.div
                                    whileHover={{ rotate: -10 }}
                                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.35)]"
                                >
                                    <Bus size={18} />
                                </motion.div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-300">
                                        Ashland
                                    </p>
                                    <p className="text-lg font-black tracking-tight text-white -mt-0.5">
                                        Public Transit
                                    </p>
                                </div>
                            </div>
                            <p className="text-sm leading-relaxed text-slate-400 max-w-md">
                                A modern, accessible transit experience for the City of
                                Ashland. Book, track, and travel with confidence — engineered
                                for real people in a real community.
                            </p>

                            <Link to="/book">
                                <motion.button
                                    whileHover={{ x: 3 }}
                                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-[0_10px_30px_rgba(59,130,246,0.35)]"
                                >
                                    Book a Ride <ArrowRight size={14} />
                                </motion.button>
                            </Link>
                        </div>

                        <FooterCol title="Explore">
                            <FooterLink to="/about">About the system</FooterLink>
                            <FooterLink to="/services">Services</FooterLink>
                            <FooterLink to="/fares">Fares</FooterLink>
                            <FooterLink to="/accessibility">Accessibility</FooterLink>
                        </FooterCol>

                        <FooterCol title="Support">
                            <FooterLink to="/faq">FAQ</FooterLink>
                            <FooterLink to="/contact">Contact</FooterLink>
                            <FooterLink to="/track">Track your ride</FooterLink>
                            <FooterLink to="/book">Book a ride</FooterLink>
                        </FooterCol>

                        <FooterCol title="Reach us">
                            <div className="flex items-start gap-2 text-xs text-slate-400">
                                <Clock size={13} className="text-blue-300 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-black text-slate-200 text-[11px] uppercase tracking-widest">
                                        Service hours
                                    </p>
                                    <p className="mt-1">Mon–Fri 6 AM – 9 PM</p>
                                    <p>Saturday 8 AM – 6 PM</p>
                                    <p>Sun + holidays closed</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-4">
                                <MapPin size={13} className="text-blue-300" />
                                Ashland, Ohio
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                <Phone size={13} className="text-blue-300" />
                                (419) 555-0199
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                <Mail size={13} className="text-blue-300" />
                                transit@ashland.gov
                            </div>
                        </FooterCol>
                    </div>

                    <div className="mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-widest font-bold text-slate-500">
                            © {new Date().getFullYear()} Ashland City Transit Project
                        </p>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500">
                            <a
                                className="hover:text-slate-300 flex items-center gap-1"
                                href="https://github.com/"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Github size={13} /> Source
                            </a>
                            <span>Built with Node, React & care.</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

const FooterCol = ({ title, children }) => (
    <div>
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-300 mb-4">
            {title}
        </p>
        <div className="space-y-2.5">{children}</div>
    </div>
);

const FooterLink = ({ to, children }) => (
    <Link
        to={to}
        className="block text-sm font-bold text-slate-300 hover:text-white transition-colors"
    >
        {children}
    </Link>
);

export default SiteFooter;
