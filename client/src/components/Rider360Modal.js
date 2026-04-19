import React, { useEffect, useState } from "react";
import {
  XCircle,
  User,
  Phone,
  Mail,
  MapPin,
  ShieldAlert,
  CheckCircle,
  Ban,
  Tag,
  Clock,
  CircleDollarSign,
  FileText,
} from "lucide-react";
import { getRider360, updateUserControl } from "../services/api";

/**
 * Rider360Modal
 * Complete dispatcher view of a single rider: identity, stats,
 * rides, notes, moderation controls (suspend / tag / flag).
 */
const StatBox = ({ label, value, color = "text-slate-800" }) => (
  <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </div>
    <div className={`text-xl font-black ${color}`}>{value}</div>
  </div>
);

const statusColor = (s) => {
  switch (s) {
    case "Completed":
      return "text-emerald-600 bg-emerald-50";
    case "Confirmed":
      return "text-blue-600 bg-blue-50";
    case "En-Route":
      return "text-indigo-600 bg-indigo-50";
    case "Cancelled":
    case "Rejected":
      return "text-red-600 bg-red-50";
    default:
      return "text-amber-600 bg-amber-50";
  }
};

const Rider360Modal = ({ riderId, onClose, onToast }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getRider360(riderId);
      setData(r);
    } catch (err) {
      onToast?.(
        `Failed to load rider: ${err.response?.data?.message || err.message}`,
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (riderId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  const applyControl = async (payload) => {
    setBusy(true);
    try {
      await updateUserControl(riderId, payload);
      onToast?.("Rider updated", "success");
      load();
    } catch (err) {
      onToast?.(
        `Update failed: ${err.response?.data?.message || err.message}`,
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || !data?.rider) return;
    const tags = Array.from(new Set([...(data.rider.tags || []), t]));
    setTagInput("");
    applyControl({ tags });
  };

  const removeTag = (tag) => {
    const tags = (data?.rider?.tags || []).filter((x) => x !== tag);
    applyControl({ tags });
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
              <User size={22} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
                Rider 360°
              </div>
              <h3 className="font-black text-xl">
                {data?.rider?.fullName ||
                  data?.rider?.username ||
                  (loading ? "Loading…" : "Rider")}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl"
          >
            <XCircle size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-5">
          {loading && <p className="text-slate-400 text-sm">Loading…</p>}
          {!loading && data && (
            <>
              {/* Identity + controls */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 md:col-span-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Identity
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User size={14} className="text-slate-400" />
                    <span className="font-bold">
                      {data.rider.username || "—"}
                    </span>
                    {data.rider.isSuspended && (
                      <span className="ml-2 text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-600 px-2 py-0.5 rounded">
                        Suspended
                      </span>
                    )}
                    {data.rider.riderType && (
                      <span className="ml-auto text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                        {data.rider.riderType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={14} className="text-slate-400" />
                    <span>{data.rider.phoneNumber || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail size={14} className="text-slate-400" />
                    <span>{data.rider.email || "—"}</span>
                  </div>
                  {data.rider.emergencyContact?.name && (
                    <div className="flex items-center gap-2 text-sm">
                      <ShieldAlert size={14} className="text-amber-500" />
                      <span>
                        ICE: {data.rider.emergencyContact.name} ·{" "}
                        {data.rider.emergencyContact.phone}
                      </span>
                    </div>
                  )}
                </div>

                {/* Moderation */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Moderation
                  </div>
                  <button
                    onClick={() =>
                      applyControl({ isSuspended: !data.rider.isSuspended })
                    }
                    disabled={busy}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border ${
                      data.rider.isSuspended
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                        : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                    } disabled:opacity-40`}
                  >
                    {data.rider.isSuspended ? (
                      <>
                        <CheckCircle size={14} /> Reinstate
                      </>
                    ) : (
                      <>
                        <Ban size={14} /> Suspend
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTag()}
                      placeholder="Add tag (VIP, Watchlist…)"
                      className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <button
                      onClick={addTag}
                      className="px-2 py-1.5 text-[10px] font-black uppercase bg-blue-600 text-white rounded-lg"
                    >
                      <Tag size={12} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(data.rider.tags || []).map((t) => (
                      <button
                        key={t}
                        onClick={() => removeTag(t)}
                        className="text-[10px] font-black uppercase tracking-widest bg-slate-200 text-slate-700 px-2 py-0.5 rounded hover:bg-red-100 hover:text-red-700"
                        title="Remove tag"
                      >
                        {t} ✕
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <StatBox label="Rides" value={data.stats.total} />
                <StatBox
                  label="Completed"
                  value={data.stats.completed}
                  color="text-emerald-600"
                />
                <StatBox
                  label="Cancelled"
                  value={data.stats.cancelled}
                  color="text-red-600"
                />
                <StatBox
                  label="No-Shows"
                  value={data.stats.noShow}
                  color="text-orange-600"
                />
                <StatBox
                  label="Spent"
                  value={`$${data.stats.totalSpent.toFixed(2)}`}
                  color="text-blue-600"
                />
              </div>
              {data.stats.outstanding > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm font-bold text-amber-700 flex items-center gap-2">
                  <CircleDollarSign size={16} />
                  Outstanding balance: ${data.stats.outstanding.toFixed(2)}
                </div>
              )}

              {/* Ride history */}
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                  <Clock size={14} /> Ride history
                </h4>
                <div className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {data.rides.slice(0, 30).map((r) => (
                    <div
                      key={r._id}
                      className="flex items-center gap-3 p-3 text-xs"
                    >
                      <span
                        className={`px-2 py-0.5 rounded font-black uppercase tracking-wider text-[10px] ${statusColor(r.status)}`}
                      >
                        {r.status}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 w-20 shrink-0">
                        {new Date(r.scheduledTime).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1 truncate flex-1">
                        <MapPin size={11} className="text-slate-400" />
                        <span className="truncate">
                          {r.pickup} → {r.dropoff}
                        </span>
                      </span>
                      <span className="font-black text-emerald-600">
                        ${Number(r.finalizedFare || r.fare || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {!data.rides.length && (
                    <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest py-8">
                      No rides for this rider
                    </p>
                  )}
                </div>
              </div>

              {/* Recent audit */}
              {!!data.audit?.length && (
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                    <FileText size={14} /> Recent moderation audit
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {data.audit.map((l) => (
                      <div
                        key={l._id}
                        className="flex items-center gap-2 p-2 text-[11px]"
                      >
                        <span className="font-mono text-slate-400">
                          {new Date(l.createdAt).toLocaleString()}
                        </span>
                        <span className="font-bold text-slate-600">
                          {l.performedBy}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-black uppercase tracking-wider">
                          {l.action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Rider360Modal;
