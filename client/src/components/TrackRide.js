import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, X, XCircle } from "lucide-react";
import { io } from "socket.io-client";
import {
  getRideByTicket,
  verifyRideCheckoutSession,
  downloadRideReceipt,
} from "../services/api";
import {
  Search, MapPin, ArrowLeft, AlertTriangle, Phone, Copy, Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";

// ── STATUS THEMES ───────────────────────────────────────────
const STATUS_THEME = {
  Pending:   { gradient: "linear-gradient(135deg,#f8fafc 0%,#eff6ff 50%,#f0f9ff 100%)", bannerBg: "bg-slate-100",    bannerText: "text-slate-600" },
  Confirmed: { gradient: "linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 50%,#f0f9ff 100%)", bannerBg: "bg-emerald-100", bannerText: "text-emerald-700" },
  "En-Route":{ gradient: "linear-gradient(135deg,#fffbeb 0%,#fef3c7 40%,#fff7ed 100%)", bannerBg: "bg-blue-600",    bannerText: "text-white" },
  Completed: { gradient: "linear-gradient(135deg,#f0fdf4 0%,#dcfce7 50%,#ecfdf5 100%)", bannerBg: "bg-emerald-500", bannerText: "text-white" },
  Cancelled: { gradient: "linear-gradient(135deg,#fef2f2 0%,#fff1f2 50%,#fafafa 100%)", bannerBg: "bg-red-100",     bannerText: "text-red-700" },
  Rejected:  { gradient: "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 50%,#fafafa 100%)", bannerBg: "bg-slate-200",   bannerText: "text-slate-500" },
};
const DEFAULT_THEME = STATUS_THEME.Pending;

// ── INLINE CHAT PANEL ───────────────────────────────────────
const SOCKET_URL = "http://localhost:5000";

const ChatPanel = ({ ride, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const room = `room_driver_${ride?.driverId || ride?._id}`;

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit("join_room", room);
    socketRef.current.on("chat_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => socketRef.current?.disconnect();
  }, [room]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const msg = { from: "Rider", text, ts: new Date().toLocaleTimeString() };
    socketRef.current?.emit("chat_message", { room, ...msg });
    setMessages((prev) => [...prev, msg]);
    setInput("");
  };

  return (
    <div className="mt-4 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-800 text-white">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} />
          <span className="font-black text-sm uppercase tracking-wider">Driver Chat</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
          <XCircle size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-4 space-y-2 bg-slate-50">
        {messages.length === 0 && (
          <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest pt-8">
            Send a message to your driver
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "Rider" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm font-medium ${m.from === "Rider" ? "bg-emerald-600 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>
              <p>{m.text}</p>
              <p className="text-[10px] opacity-60 mt-0.5">{m.ts}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-slate-100">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium"
        />
        <button
          onClick={send}
          className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ──────────────────────────────────────────
const TrackRide = () => {
  const [searchParams] = useSearchParams();
  const [ticketId, setTicketId] = useState(searchParams.get("ticketId") || "");
  const [ride, setRide] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const copyToClipboard = () => {
    if (ride?.ticketId) {
      navigator.clipboard.writeText(ride.ticketId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchRideStatus = async (id) => {
    try {
      const data = await getRideByTicket(id.trim());
      setRide(data);
      setError("");
    } catch {
      setError("Ticket ID not found. Please check and try again.");
      setRide(null);
    }
  };

  useEffect(() => {
    const urlId = searchParams.get("ticketId");
    const checkoutSessionId = searchParams.get("checkoutSessionId");
    if (urlId) {
      setTicketId(urlId);
      setLoading(true);
      const verifyAndFetch = async () => {
        if (checkoutSessionId) {
          setVerifyingPayment(true);
          try {
            await verifyRideCheckoutSession(checkoutSessionId, urlId);
          } catch (e) {
            console.error("Payment verification failed:", e);
          } finally {
            setVerifyingPayment(false);
          }
        }
        await fetchRideStatus(urlId);
      };
      verifyAndFetch().finally(() => setLoading(false));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!ride || ride.status === "Completed" || ride.status === "Cancelled") return;
    const interval = setInterval(() => fetchRideStatus(ticketId), 10000);
    return () => clearInterval(interval);
  }, [ride, ticketId]);

  const handleTrack = async (e) => {
    e.preventDefault();
    setLoading(true);
    await fetchRideStatus(ticketId);
    setLoading(false);
  };

  const theme = ride?.status
    ? STATUS_THEME[ride.status] || DEFAULT_THEME
    : DEFAULT_THEME;

  const handleReceiptDownload = async () => {
    try {
      const blob = await downloadRideReceipt(ride.ticketId);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ride.ticketId}-receipt.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError("Receipt is not ready yet. Please try again.");
    }
  };

  return (
    <motion.div
      className="min-h-screen p-4 font-sans flex flex-col items-center"
      animate={{ background: theme.gradient }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
    >
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-8 pt-4">
        <Link to="/" className="p-2 bg-white rounded-xl shadow-sm hover:bg-slate-100 transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <h1 className="text-lg font-black text-slate-800 uppercase tracking-widest">Track My Ride</h1>
        <div className="w-10" />
      </div>

      <AnimatePresence mode="wait">
        {!ride ? (
          // ── SEARCH CARD ──
          <motion.div
            key="search"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] mb-6 border border-white/20"
          >
            <form onSubmit={handleTrack} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Enter Ticket ID (e.g. ASH-ICB)"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-lg outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 transition-all uppercase placeholder:normal-case placeholder:font-medium text-center tracking-widest text-slate-800 shadow-sm"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value.toUpperCase())}
                />
              </div>
              <motion.button
                disabled={!ticketId || loading}
                whileHover={!ticketId || loading ? {} : { scale: 1.02 }}
                whileTap={!ticketId || loading ? {} : { scale: 0.97 }}
                className="relative overflow-hidden group w-full py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                {loading ? "Searching..." : "Track Ride"}
              </motion.button>
            </form>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2"
              >
                <AlertTriangle size={16} /> {error}
              </motion.div>
            )}
          </motion.div>
        ) : (
          // ── STATUS CARD ──
          <motion.div
            key="status"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md"
          >
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden border border-white/20 relative">
              {/* Status Banner */}
              <motion.div
                key={ride.status}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`p-6 text-center ${theme.bannerBg} ${theme.bannerText} transition-colors duration-700`}
              >
                <h2 className="text-3xl font-black uppercase tracking-tighter">{ride.status}</h2>
                {ride.status === "En-Route" && (
                  <motion.p
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="text-blue-100 font-bold mt-1"
                  >
                    Driver is on the way!
                  </motion.p>
                )}
                {ride.status === "Completed" && (
                  <p className="text-emerald-100 font-bold mt-1">Ride complete. Thank you! 🎉</p>
                )}
              </motion.div>

              <div className="p-8">
                {/* Ticket header */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Your Ticket</h2>
                    <div className="flex items-center gap-2 mt-1 cursor-pointer" onClick={copyToClipboard}>
                      <p className="text-slate-500 font-mono text-sm hover:text-blue-600 transition-colors" title="Click to copy">
                        #{ride.ticketId}
                      </p>
                      {copied
                        ? <Check size={14} className="text-emerald-500" />
                        : <Copy size={14} className="text-slate-300 hover:text-blue-500 cursor-pointer" />}
                      <span className={`text-[10px] font-bold ${copied ? "text-emerald-500 opacity-100" : "opacity-0"} transition-opacity`}>
                        Copied!
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Fare</p>
                    <p className="text-2xl font-black text-slate-900">${ride.fare.toFixed(2)}</p>
                    <p className={`text-[10px] font-bold mt-1 ${ride.paymentStatus === "Paid" ? "text-emerald-600" : "text-amber-600"}`}>
                      Payment: {ride.paymentStatus || "Pending"} ({ride.paymentMethod || "Cash"})
                    </p>
                  </div>
                </div>

                {(verifyingPayment || searchParams.get("paymentCancelled") === "true") && (
                  <div className={`mb-4 p-3 rounded-xl text-xs font-bold ${verifyingPayment ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                    {verifyingPayment
                      ? "Verifying payment with Stripe..."
                      : "Payment was cancelled. You can try again from booking."}
                  </div>
                )}

                {/* QR Code – shown when ride is active */}
                {(ride.status === "Confirmed" || ride.status === "En-Route") && (
                  <motion.div
                    className="mb-8 flex flex-col items-center bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="bg-white p-2 rounded-xl shadow-sm mb-3">
                      <QRCodeSVG
                        value={JSON.stringify({ id: ride.ticketId, name: ride.passengerName, status: ride.status })}
                        size={128}
                        level="H"
                        fgColor="#0f172a"
                      />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scan to Board</p>
                  </motion.div>
                )}

                {/* Route details */}
                <div className="space-y-6">
                  <div className="flex gap-4 items-start">
                    <div className="mt-1 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Pickup</p>
                      <p className="font-bold text-slate-800">{ride.pickup}</p>
                      {ride.pickupDetails && (
                        <p className="text-xs text-amber-600 font-bold mt-1 bg-amber-50 inline-block px-2 py-1 rounded-lg">
                          Note: {ride.pickupDetails}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="mt-1 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Drop-off</p>
                      <p className="font-bold text-slate-800">{ride.dropoff}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-8 grid gap-3">
                  {ride.paymentStatus === "Paid" && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleReceiptDownload}
                      className="w-full py-4 bg-emerald-50 text-emerald-700 font-black rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 uppercase text-xs tracking-wider"
                    >
                      Download Receipt
                    </motion.button>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      const origin = encodeURIComponent(ride.pickup + ", Ashland, OH");
                      const dest = encodeURIComponent(ride.dropoff + ", Ashland, OH");
                      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`, "_blank");
                    }}
                    className="w-full py-4 bg-blue-50 text-blue-700 font-black rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 uppercase text-xs tracking-wider"
                  >
                    <MapPin size={18} /> View Route Map
                  </motion.button>

                  {/* ── CHAT BUTTON – now opens inline chat panel ── */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowChat((v) => !v)}
                    className={`w-full py-4 font-black rounded-xl flex items-center justify-center gap-2 uppercase text-xs tracking-wider transition-colors ${showChat ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                  >
                    <MessageCircle size={18} />
                    {showChat ? "Close Chat" : "Chat with Driver"}
                  </motion.button>

                  <a
                    href="tel:5550199"
                    className="w-full py-4 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 uppercase text-xs tracking-wider"
                  >
                    <Phone size={18} /> Call Dispatch
                  </a>
                </div>

                {/* Inline Chat Panel */}
                {showChat && <ChatPanel ride={ride} onClose={() => setShowChat(false)} />}
              </div>
            </div>

            {/* Search again */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setRide(null); setShowChat(false); }}
              className="w-full mt-4 py-3 text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
            >
              ← Search another ticket
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TrackRide;
