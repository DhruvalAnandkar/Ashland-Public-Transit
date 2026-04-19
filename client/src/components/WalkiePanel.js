import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Send, X, Volume2, VolumeX, AlertTriangle } from "lucide-react";

/**
 * Walkie-talkie panel — works for BOTH driver and dispatcher sides.
 *
 * props:
 *  - mode: "driver" | "dispatcher"
 *  - messages: [{ from, message, severity, timestamp, direction? }]
 *  - onSend: (text, severity) => void
 *  - onClose: () => void
 *  - title?: string
 *
 * Plays a short "radio click" tone on incoming/outgoing messages (using
 * the Web Audio API — no asset required).
 */
const WalkiePanel = ({ mode = "driver", messages = [], onSend, onClose, title }) => {
    const [text, setText] = useState("");
    const [severity, setSeverity] = useState("info");
    const [muted, setMuted] = useState(false);
    const listRef = useRef(null);
    const lastLenRef = useRef(0);

    useEffect(() => {
        if (messages.length > lastLenRef.current && !muted) {
            playRadioClick();
        }
        lastLenRef.current = messages.length;
        // Auto-scroll to bottom
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages, muted]);

    const send = () => {
        const t = text.trim();
        if (!t) return;
        onSend?.(t, severity);
        setText("");
        if (!muted) playRadioClick(true);
    };

    const presets =
        mode === "driver"
            ? ["Arrived at pickup", "Running 5 min late", "Traffic ahead", "Need support"]
            : ["Proceed with ride", "Hold position", "Return to base", "Standby"];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-4 right-4 z-[120] w-[360px] max-w-[92vw] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
        >
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-400/40 flex items-center justify-center">
                        <Radio size={16} className="text-red-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 leading-none">
                            {mode === "driver" ? "Dispatch Radio" : "Driver Radio"}
                        </p>
                        <p className="text-sm font-black leading-tight">{title || "Walkie Channel"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setMuted((m) => !m)}
                        className="p-1.5 hover:bg-white/10 rounded-lg"
                        title={muted ? "Unmute tones" : "Mute tones"}
                    >
                        {muted ? (
                            <VolumeX size={14} className="text-slate-400" />
                        ) : (
                            <Volume2 size={14} className="text-emerald-400" />
                        )}
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div
                ref={listRef}
                className="h-64 overflow-y-auto bg-slate-50 px-3 py-3 space-y-2"
            >
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6">
                        <Radio size={26} className="text-slate-300 mb-2" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Channel quiet
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                            Send a quick blast or wait for dispatch.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {messages.map((m, i) => {
                            const mine = m.direction === "out";
                            const sevColor =
                                m.severity === "urgent"
                                    ? "bg-red-500 text-white"
                                    : m.severity === "warning"
                                        ? "bg-amber-500 text-white"
                                        : mine
                                            ? "bg-blue-600 text-white"
                                            : "bg-white text-slate-700 border border-slate-200";
                            return (
                                <motion.div
                                    key={m.id || i}
                                    layout
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                                >
                                    <div className={`max-w-[80%] rounded-xl px-3 py-2 shadow-sm ${sevColor}`}>
                                        <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest opacity-75 mb-0.5">
                                            {m.severity === "urgent" && (
                                                <AlertTriangle size={9} />
                                            )}
                                            <span>{mine ? "You" : m.from || "—"}</span>
                                            <span>·</span>
                                            <span>
                                                {new Date(m.timestamp || Date.now()).toLocaleTimeString(
                                                    "en-US",
                                                    { hour: "numeric", minute: "2-digit" },
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-xs font-semibold leading-snug break-words">
                                            {m.message}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap gap-1 bg-white">
                {presets.map((p) => (
                    <button
                        key={p}
                        onClick={() => setText(p)}
                        className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200"
                    >
                        {p}
                    </button>
                ))}
            </div>

            <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
                <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="text-[11px] font-black uppercase px-2 py-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700"
                >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="urgent">Urgent</option>
                </select>
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Transmit…"
                    className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-blue-400"
                />
                <button
                    onClick={send}
                    className="p-2 rounded-lg bg-gradient-to-br from-red-600 to-red-500 text-white shadow-md shadow-red-200 hover:brightness-110"
                >
                    <Send size={16} />
                </button>
            </div>
        </motion.div>
    );
};

// Short radio-click tone using Web Audio API. No asset required.
let _ac = null;
const playRadioClick = (outgoing = false) => {
    try {
        if (typeof window === "undefined") return;
        _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
        const ctx = _ac;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(outgoing ? 880 : 620, now);
        osc.frequency.exponentialRampToValueAtTime(outgoing ? 660 : 440, now + 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
    } catch {
        // Browsers block autoplay until first user interaction; silent fallback.
    }
};

export default WalkiePanel;
