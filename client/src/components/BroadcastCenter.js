import React, { useState } from "react";
import { Radio, XCircle, Send, Users, Truck } from "lucide-react";
import { sendBroadcast } from "../services/api";

/**
 * BroadcastCenter
 * Lets the dispatcher send an operational message to all drivers,
 * all riders, or everyone. Powered by Socket.IO on the server.
 */
const BroadcastCenter = ({ onClose, onToast }) => {
  const [audience, setAudience] = useState("drivers");
  const [severity, setSeverity] = useState("info");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendBroadcast({ audience, message: text, severity });
      onToast?.(`Broadcast sent to ${audience}.`, "success");
      setMessage("");
      onClose?.();
    } catch (err) {
      onToast?.(
        `Broadcast failed: ${err.response?.data?.message || err.message}`,
        "error",
      );
    } finally {
      setSending(false);
    }
  };

  const presets = [
    "Heavy traffic on Claremont Ave — expect delays.",
    "Weather advisory: drive with caution.",
    "Fleet-wide all-hands in 15 minutes.",
    "Service will close 30 min early today.",
  ];

  return (
    <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 bg-purple-600 text-white">
          <div className="flex items-center gap-3">
            <Radio size={22} />
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
                Dispatch
              </div>
              <h3 className="font-black text-lg">Broadcast Center</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <XCircle size={22} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Audience */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
              Audience
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "drivers", label: "Drivers", icon: Truck },
                { id: "riders", label: "Riders", icon: Users },
                { id: "all", label: "Everyone", icon: Radio },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setAudience(id)}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${
                    audience === id
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
              Severity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["info", "warning", "critical"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border ${
                    severity === s
                      ? s === "critical"
                        ? "bg-red-600 text-white border-red-600"
                        : s === "warning"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
              Quick presets
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setMessage(p)}
                  className="text-[11px] font-bold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type your broadcast message…"
              className="w-full p-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none font-medium text-sm resize-none"
              maxLength={500}
            />
            <p className="text-[10px] font-bold text-slate-400 mt-1 text-right">
              {message.length}/500
            </p>
          </div>

          <button
            onClick={send}
            disabled={sending || !message.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-purple-600 text-white font-black uppercase tracking-widest hover:bg-purple-500 disabled:opacity-40 transition-colors"
          >
            <Send size={16} />
            {sending ? "Sending…" : "Send broadcast"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BroadcastCenter;
