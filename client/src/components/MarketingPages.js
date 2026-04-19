import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    ArrowRight,
    CheckCircle2,
    Clock,
    MapPin,
    Phone,
    Mail,
    Accessibility,
    ShieldCheck,
    Sparkles,
    Users,
    Bus,
    Radio,
    ChevronDown,
    Zap,
    Heart,
    CreditCard,
    Leaf,
    GraduationCap,
    Building2,
} from "lucide-react";

// ─── Common marketing shell ──────────────────────────────────────
const PageShell = ({ eyebrow, title, subtitle, accent = "blue", children }) => {
    const accents = {
        blue: "from-blue-500 via-indigo-500 to-violet-500",
        emerald: "from-emerald-500 via-teal-500 to-cyan-500",
        amber: "from-amber-500 via-orange-500 to-rose-500",
        violet: "from-violet-500 via-fuchsia-500 to-pink-500",
    };
    return (
        <div className="relative pt-28 pb-20 min-h-[80vh]">
            {/* Backdrop aurora */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-20 w-[520px] h-[520px] rounded-full blur-[120px] opacity-50 bg-gradient-to-br from-blue-300 via-indigo-300 to-violet-300" />
                <div className="absolute top-40 -right-24 w-[480px] h-[480px] rounded-full blur-[120px] opacity-40 bg-gradient-to-br from-emerald-200 via-teal-200 to-sky-200" />
            </div>

            <motion.section
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="relative max-w-5xl mx-auto px-6 sm:px-8 text-center"
            >
                {eyebrow && (
                    <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 backdrop-blur border border-white/70 text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-5 shadow-sm">
                        <Sparkles size={11} /> {eyebrow}
                    </p>
                )}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.08]">
                    {title.split("|").map((part, i) =>
                        i % 2 === 0 ? (
                            <span key={i}>{part}</span>
                        ) : (
                            <span
                                key={i}
                                className={`bg-clip-text text-transparent bg-gradient-to-r ${accents[accent]}`}
                            >
                                {part}
                            </span>
                        ),
                    )}
                </h1>
                {subtitle && (
                    <p className="mt-5 text-base md:text-lg text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto">
                        {subtitle}
                    </p>
                )}
            </motion.section>

            <div className="relative max-w-6xl mx-auto px-6 sm:px-8 mt-14">{children}</div>
        </div>
    );
};

// ─── Shared card primitive ───────────────────────────────────────
const Card = ({ children, className = "", delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -4 }}
        className={`bg-white/85 backdrop-blur-xl rounded-2xl border border-white/70 shadow-[0_10px_40px_rgba(15,23,42,0.06)] p-6 md:p-7 ${className}`}
    >
        {children}
    </motion.div>
);

// ─── About page ─────────────────────────────────────────────────
export const AboutPage = () => (
    <PageShell
        eyebrow="Our story"
        title="Transit designed for |real people, real places|"
        subtitle="Ashland Public Transit is built on a simple idea: a ride shouldn't be the hardest part of your day. We combine a modern dispatch platform with human-first service across Ashland, Ohio."
        accent="blue"
    >
        <div className="grid md:grid-cols-3 gap-5">
            {[
                {
                    Icon: Heart,
                    title: "Community first",
                    text: "Built for seniors, students, veterans, workers, and families who count on public transit every single day.",
                },
                {
                    Icon: ShieldCheck,
                    title: "Reliable by design",
                    text: "Live dispatch, GPS-verified pickups, and clear rider notifications — so you always know what's next.",
                },
                {
                    Icon: Leaf,
                    title: "Lower carbon rides",
                    text: "Shared vehicles, optimized routing, and right-sized fleet decisions that keep Ashland moving with less waste.",
                },
            ].map((f, i) => (
                <Card key={f.title} delay={i * 0.08}>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-[0_10px_30px_rgba(59,130,246,0.35)]">
                        <f.Icon size={20} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-1.5">{f.title}</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        {f.text}
                    </p>
                </Card>
            ))}
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-5">
            <Card>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-3">
                    What we run
                </p>
                <h3 className="text-2xl font-black text-slate-800">
                    A connected platform end to end
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600 font-medium">
                    {[
                        "Rider mobile app for booking, tickets & live tracking",
                        "Dispatcher command center with real-time ops and KPIs",
                        "Driver cab-app with live navigation + walkie to dispatch",
                        "Fleet manager with maintenance logs and driver assignments",
                    ].map((t) => (
                        <li key={t} className="flex items-start gap-2">
                            <CheckCircle2
                                size={15}
                                className="text-emerald-500 mt-0.5 shrink-0"
                            />
                            {t}
                        </li>
                    ))}
                </ul>
            </Card>
            <Card>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-3">
                    Who it's for
                </p>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { Icon: Users, label: "Residents", tone: "bg-blue-50 text-blue-600" },
                        { Icon: Accessibility, label: "Elderly & disabled", tone: "bg-emerald-50 text-emerald-600" },
                        { Icon: GraduationCap, label: "Students", tone: "bg-violet-50 text-violet-600" },
                        { Icon: Building2, label: "Workforce", tone: "bg-amber-50 text-amber-600" },
                    ].map((x) => (
                        <div
                            key={x.label}
                            className="rounded-xl border border-slate-100 bg-white/80 p-3 flex items-center gap-2"
                        >
                            <div className={`w-9 h-9 rounded-lg ${x.tone} flex items-center justify-center`}>
                                <x.Icon size={16} />
                            </div>
                            <span className="text-sm font-black text-slate-700">{x.label}</span>
                        </div>
                    ))}
                </div>
                <p className="mt-4 text-sm text-slate-500 font-medium leading-relaxed">
                    Built for every rider, with fare tiers, priority handling, and service
                    protocols aligned to City of Ashland public-transit policy.
                </p>
            </Card>
        </div>
    </PageShell>
);

// ─── Services page ──────────────────────────────────────────────
export const ServicesPage = () => (
    <PageShell
        eyebrow="How we get you there"
        title="Services that move with |your schedule|"
        subtitle="Scheduled rides, same-day service, accessible vehicles, and dispatcher-supported travel — all on one app."
        accent="violet"
    >
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
                {
                    Icon: Clock,
                    title: "Scheduled rides",
                    text: "Book 24 hours ahead for the best fare. Pick your exact time, pickup, and drop-off — we handle the rest.",
                    badge: "$3.00 base",
                },
                {
                    Icon: Zap,
                    title: "Same-day service",
                    text: "Need a ride today? Same-day bookings use a small surcharge and are confirmed subject to fleet capacity.",
                    badge: "$5.00 base",
                },
                {
                    Icon: Accessibility,
                    title: "Accessible trips",
                    text: "Reduced fare for elderly and disabled riders. Wheelchair-accessible vehicles available on request.",
                    badge: "$1.50 scheduled",
                },
                {
                    Icon: Users,
                    title: "Companions & family",
                    text: "Children under 12 ride free with an adult. Companion passengers travel at a reduced fare to the same destination.",
                    badge: "Family-friendly",
                },
                {
                    Icon: Radio,
                    title: "Live dispatch",
                    text: "Our dispatchers keep your ride on track with real-time monitoring, driver chat, and instant schedule recovery.",
                    badge: "Humans in the loop",
                },
                {
                    Icon: CreditCard,
                    title: "Simple checkout",
                    text: "Pay on the app with a saved card, or settle up at pickup. Clear receipts delivered by email automatically.",
                    badge: "Card & in-person",
                },
            ].map((s, i) => (
                <Card key={s.title} delay={i * 0.06} className="flex flex-col">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white flex items-center justify-center mb-4 shadow-[0_10px_30px_rgba(139,92,246,0.35)]">
                        <s.Icon size={20} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-1.5">{s.title}</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed flex-1">
                        {s.text}
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-3 py-1 w-max">
                        <Sparkles size={11} /> {s.badge}
                    </div>
                </Card>
            ))}
        </div>
    </PageShell>
);

// ─── Fares page — driven by the real fare calculator data ───────
const FARE_ROWS = [
    { label: "General adult", s: 3.0, d: 5.0 },
    { label: "Elderly / disabled", s: 1.5, d: 2.5 },
    { label: "Children under 12 (with adult)", s: 0, d: 0 },
    { label: "Children under 12 (alone)", s: 1.5, d: 1.5 },
    { label: "Companion (same destination)", s: 1.5, d: 2.5 },
];

export const FaresPage = () => (
    <PageShell
        eyebrow="Transparent pricing"
        title="Simple, |city-aligned| fares"
        subtitle="Rates reflect the City of Ashland's published transit policy. Book at least 24 hours ahead to lock in the scheduled rate."
        accent="emerald"
    >
        <Card className="overflow-hidden p-0">
            <div className="grid grid-cols-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border-b border-slate-100 px-6 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                    Rider type
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500 text-center">
                    Scheduled (24h+)
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500 text-center">
                    Same-day
                </p>
            </div>
            {FARE_ROWS.map((r) => (
                <div
                    key={r.label}
                    className="grid grid-cols-3 px-6 py-4 border-b border-slate-50 last:border-0 items-center"
                >
                    <p className="text-sm font-bold text-slate-700">{r.label}</p>
                    <p className="text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-black">
                            {r.s === 0 ? "FREE" : `$${r.s.toFixed(2)}`}
                        </span>
                    </p>
                    <p className="text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-sm font-black">
                            {r.d === 0 ? "FREE" : `$${r.d.toFixed(2)}`}
                        </span>
                    </p>
                </div>
            ))}
        </Card>

        <div className="mt-6 grid md:grid-cols-3 gap-4">
            <Card>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-2">
                    No-show fee
                </p>
                <p className="text-sm font-medium text-slate-600">
                    $3.00 for General riders, $1.50 for Elderly/Disabled riders when a
                    scheduled pickup cannot be completed because the rider is not
                    present. Fees are automatically totaled to the account.
                </p>
            </Card>
            <Card>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-2">
                    Service hours
                </p>
                <p className="text-sm font-medium text-slate-600">
                    Monday – Friday 6:00 AM – 9:00 PM · Saturday 8:00 AM – 6:00 PM ·
                    Sundays and observed holidays the service is closed.
                </p>
            </Card>
            <Card>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-2">
                    How scheduled works
                </p>
                <p className="text-sm font-medium text-slate-600">
                    Book at least 24 hours before your pickup to qualify for the
                    scheduled rate. Anything less becomes same-day and uses the
                    same-day rate shown above.
                </p>
            </Card>
        </div>

        <div className="mt-10 text-center">
            <Link to="/book">
                <motion.button
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-sm uppercase tracking-widest shadow-[0_14px_34px_rgba(16,185,129,0.35)]"
                >
                    Book your ride <ArrowRight size={16} className="inline-block ml-1" />
                </motion.button>
            </Link>
        </div>
    </PageShell>
);

// ─── Accessibility page ─────────────────────────────────────────
export const AccessibilityPage = () => (
    <PageShell
        eyebrow="For every rider"
        title="Accessibility |by default|"
        subtitle="Ashland Public Transit is committed to dignified, reliable service for riders with mobility, sensory, or cognitive needs."
        accent="emerald"
    >
        <div className="grid md:grid-cols-2 gap-5">
            {[
                {
                    Icon: Accessibility,
                    title: "Wheelchair & mobility",
                    text: "Request a lift-equipped vehicle when booking. Drivers are trained to assist with boarding and securement.",
                },
                {
                    Icon: Heart,
                    title: "Priority service",
                    text: "Elderly and disabled riders receive reduced fares ($1.50 scheduled / $2.50 same-day) and priority handling in dispatch.",
                },
                {
                    Icon: Users,
                    title: "Traveling with support",
                    text: "Personal care attendants may ride without charge when assisting a rider with a verified need — let dispatch know in advance.",
                },
                {
                    Icon: Phone,
                    title: "Speak with a real human",
                    text: "Call our dispatch line any time the system is open to book, change, or cancel a ride with a live dispatcher.",
                },
            ].map((f, i) => (
                <Card key={f.title} delay={i * 0.07}>
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-[0_10px_24px_rgba(16,185,129,0.35)]">
                            <f.Icon size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800">{f.title}</h3>
                            <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                                {f.text}
                            </p>
                        </div>
                    </div>
                </Card>
            ))}
        </div>

        <Card className="mt-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-3">
                Digital accessibility
            </p>
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
                Our rider app and website follow WCAG 2.1 AA practices — scalable text,
                high-contrast color tokens, large touch targets, reduced-motion support,
                and keyboard-navigable flows. Found an issue? Tell us — we fix these
                in-sprint, not in a roadmap.
            </p>
        </Card>
    </PageShell>
);

// ─── FAQ page ───────────────────────────────────────────────────
const FAQ_ITEMS = [
    {
        q: "How do I book a ride?",
        a: "Open the rider app or click Book a Ride on the website. Enter pickup, drop-off, and time. We'll estimate the fare instantly and confirm the ride within seconds.",
    },
    {
        q: "How early do I need to schedule?",
        a: "Booking at least 24 hours ahead unlocks the scheduled fare (e.g. $3.00 general). Anything inside that window is treated as same-day and uses the same-day rate.",
    },
    {
        q: "Can I track my ride live?",
        a: "Yes. Once a driver is assigned, you'll see their vehicle name, estimated arrival, and a live pin on the map. Your ticket updates in real time.",
    },
    {
        q: "Do you offer accessible vehicles?",
        a: "Absolutely. Select the accessibility option when booking, or call dispatch. Elderly and disabled fares are also discounted to $1.50 scheduled / $2.50 same-day.",
    },
    {
        q: "What happens if I miss my ride?",
        a: "A no-show fee is billed automatically — $3.00 general, $1.50 elderly/disabled — so we can keep service fair for other riders.",
    },
    {
        q: "Do children ride free?",
        a: "Children under 12 ride free when accompanied by an adult. Unaccompanied children under 12 pay the reduced $1.50 fare.",
    },
    {
        q: "Which cards do you accept?",
        a: "All major cards through a secure Stripe checkout. You can save a card to your profile or pay on the spot — your receipts are emailed automatically.",
    },
    {
        q: "How do I contact a dispatcher?",
        a: "Use the Contact page for hours and a direct phone line, or message your driver in-app while a ride is in progress.",
    },
];

export const FAQPage = () => {
    const [open, setOpen] = useState(0);
    return (
        <PageShell
            eyebrow="Got questions?"
            title="Answers, |in plain English|"
            subtitle="Everything you need to know before, during, and after your ride."
            accent="amber"
        >
            <div className="max-w-3xl mx-auto space-y-3">
                {FAQ_ITEMS.map((item, i) => {
                    const isOpen = open === i;
                    return (
                        <motion.div
                            key={item.q}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.04 }}
                            className={`rounded-2xl border bg-white/85 backdrop-blur-xl overflow-hidden shadow-sm ${isOpen ? "border-amber-200" : "border-white/70"}`}
                        >
                            <button
                                onClick={() => setOpen(isOpen ? -1 : i)}
                                className="w-full flex items-center justify-between px-5 py-4 text-left"
                            >
                                <span className="text-sm md:text-base font-black text-slate-800">
                                    {item.q}
                                </span>
                                <motion.span
                                    animate={{ rotate: isOpen ? 180 : 0 }}
                                    transition={{ duration: 0.25 }}
                                    className={`shrink-0 ml-4 w-8 h-8 rounded-lg flex items-center justify-center ${isOpen ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}
                                >
                                    <ChevronDown size={15} />
                                </motion.span>
                            </button>
                            <motion.div
                                initial={false}
                                animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden"
                            >
                                <p className="px-5 pb-5 text-sm text-slate-500 font-medium leading-relaxed">
                                    {item.a}
                                </p>
                            </motion.div>
                        </motion.div>
                    );
                })}
            </div>
        </PageShell>
    );
};

// ─── Contact page ───────────────────────────────────────────────
export const ContactPage = () => {
    const [form, setForm] = useState({ name: "", email: "", topic: "General", message: "" });
    const [sent, setSent] = useState(false);

    const submit = (e) => {
        e.preventDefault();
        // Purely presentational — routes to a mailto so it "just works" without backend glue.
        const href = `mailto:transit@ashland.gov?subject=${encodeURIComponent(`[${form.topic}] from ${form.name}`)}&body=${encodeURIComponent(form.message + "\n\nReply to: " + form.email)}`;
        window.location.href = href;
        setSent(true);
    };

    return (
        <PageShell
            eyebrow="We're listening"
            title="Let's talk |about your ride|"
            subtitle="For booking help, accessibility requests, or press inquiries — reach our team any time during service hours."
            accent="blue"
        >
            <div className="grid md:grid-cols-3 gap-5">
                <Card>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                        <Phone size={18} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                        Dispatch line
                    </p>
                    <p className="text-lg font-black text-slate-800 mt-1">(419) 555-0199</p>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Staffed during all service hours
                    </p>
                </Card>
                <Card>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                        <Mail size={18} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                        Email
                    </p>
                    <p className="text-lg font-black text-slate-800 mt-1">
                        transit@ashland.gov
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Typical response within one business day
                    </p>
                </Card>
                <Card>
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
                        <MapPin size={18} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                        Visit us
                    </p>
                    <p className="text-lg font-black text-slate-800 mt-1">
                        Ashland Transit Hub
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Ashland, Ohio
                    </p>
                </Card>
            </div>

            <Card className="mt-6 p-8">
                <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
                    <label className="block">
                        <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                            Your name
                        </span>
                        <input
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-400 outline-none text-sm font-semibold text-slate-800"
                        />
                    </label>
                    <label className="block">
                        <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                            Email
                        </span>
                        <input
                            required
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-400 outline-none text-sm font-semibold text-slate-800"
                        />
                    </label>
                    <label className="block md:col-span-2">
                        <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                            Topic
                        </span>
                        <select
                            value={form.topic}
                            onChange={(e) => setForm({ ...form, topic: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-400 outline-none text-sm font-semibold text-slate-800"
                        >
                            <option>General</option>
                            <option>Booking help</option>
                            <option>Accessibility request</option>
                            <option>Billing</option>
                            <option>Press / partnerships</option>
                        </select>
                    </label>
                    <label className="block md:col-span-2">
                        <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                            Message
                        </span>
                        <textarea
                            required
                            rows={5}
                            value={form.message}
                            onChange={(e) => setForm({ ...form, message: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-400 outline-none text-sm font-semibold text-slate-800 resize-none"
                        />
                    </label>
                    <div className="md:col-span-2 flex items-center justify-between">
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                            {sent
                                ? "Opened your email client — we'll respond soon."
                                : "We'll route this straight to the right desk."}
                        </p>
                        <motion.button
                            whileHover={{ scale: 1.04, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            type="submit"
                            className="px-6 py-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-[0_10px_28px_rgba(37,99,235,0.35)]"
                        >
                            Send message
                        </motion.button>
                    </div>
                </form>
            </Card>
        </PageShell>
    );
};
