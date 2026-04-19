import React, { useEffect, useState } from "react";
import {
  XCircle,
  Truck,
  Phone,
  MapPin,
  CheckCircle,
  Ban,
  MessageCircle,
  Tag,
  Clock,
  Activity,
  FileText,
  Gauge,
} from "lucide-react";
import { getDriver360, updateDriverProfile } from "../services/api";

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

const Driver360Modal = ({ driverId, onClose, onToast, onOpenChat }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getDriver360(driverId));
    } catch (err) {
      onToast?.(
        `Failed to load driver: ${err.response?.data?.message || err.message}`,
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (driverId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const applyUpdate = async (payload) => {
    setBusy(true);
    try {
      await updateDriverProfile(driverId, payload);
      onToast?.("Driver updated", "success");
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
    if (!t) return;
    const tags = Array.from(new Set([...(data?.driver?.tags || []), t]));
    setTagInput("");
    applyUpdate({ tags });
  };
  const removeTag = (tag) => {
    const tags = (data?.driver?.tags || []).filter((x) => x !== tag);
    applyUpdate({ tags });
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-indigo-700 to-purple-700 text-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
              <Truck size={22} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
                Driver 360°
              </div>
              <h3 className="font-black text-xl">
                {data?.driver?.fullName ||
                  data?.driver?.username ||
                  (loading ? "Loading…" : "Driver")}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data?.driver && (
              <button
                onClick={() => onOpenChat?.(data.driver)}
                className="px-3 py-2 text-[11px] font-black uppercase tracking-widest bg-white/15 hover:bg-white/25 rounded-xl flex items-center gap-1.5"
              >
                <MessageCircle size={14} /> Chat
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl"
            >
              <XCircle size={22} />
            </button>
          </div>
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
                    <Truck size={14} className="text-slate-400" />
                    <span className="font-bold">{data.driver.username}</span>
                    <span
                      className={`ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                        data.stats.onlineNow
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {data.stats.onlineNow ? "Online" : "Offline"}
                    </span>
                    {data.driver.isSuspended && (
                      <span className="text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-600 px-2 py-0.5 rounded">
                        Suspended
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={14} className="text-slate-400" />
                    <span>{data.driver.phoneNumber || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText size={14} className="text-slate-400" />
                    <span>License: {data.driver.licenseNumber || "—"}</span>
                  </div>
                  {data.vehicle && (
                    <div className="flex items-center gap-2 text-sm">
                      <Gauge size={14} className="text-slate-400" />
                      <span>
                        Vehicle: <b>{data.vehicle.name}</b> ·{" "}
                        {data.vehicle.type} · Cap {data.vehicle.capacity}
                      </span>
                    </div>
                  )}
                  {data.stats.lastLocationUpdate && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Clock size={12} />
                      Last GPS:{" "}
                      {new Date(data.stats.lastLocationUpdate).toLocaleString()}
                    </div>
                  )}
                  {data.stats.lastLocation?.coordinates?.length === 2 && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <MapPin size={12} className="text-blue-500" />
                      {data.stats.lastLocation.coordinates[1].toFixed(5)},{" "}
                      {data.stats.lastLocation.coordinates[0].toFixed(5)}
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Controls
                  </div>
                  <button
                    onClick={() =>
                      applyUpdate({ isSuspended: !data.driver.isSuspended })
                    }
                    disabled={busy}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border ${
                      data.driver.isSuspended
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                        : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                    } disabled:opacity-40`}
                  >
                    {data.driver.isSuspended ? (
                      <>
                        <CheckCircle size={14} /> Reinstate driver
                      </>
                    ) : (
                      <>
                        <Ban size={14} /> Suspend driver
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTag()}
                      placeholder="Add tag (Veteran, Trainer…)"
                      className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <button
                      onClick={addTag}
                      className="px-2 py-1.5 text-[10px] font-black uppercase bg-indigo-600 text-white rounded-lg"
                    >
                      <Tag size={12} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(data.driver.tags || []).map((t) => (
                      <button
                        key={t}
                        onClick={() => removeTag(t)}
                        className="text-[10px] font-black uppercase tracking-widest bg-slate-200 text-slate-700 px-2 py-0.5 rounded hover:bg-red-100 hover:text-red-700"
                      >
                        {t} ✕
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 30-day performance */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatBox label="Rides (30d)" value={data.stats.rides30d} />
                <StatBox
                  label="Completed"
                  value={data.stats.completed30d}
                  color="text-emerald-600"
                />
                <StatBox
                  label="Pax served"
                  value={data.stats.passengers30d}
                  color="text-indigo-600"
                />
                <StatBox
                  label="Revenue"
                  value={`$${data.stats.revenue30d.toFixed(2)}`}
                  color="text-blue-600"
                />
              </div>

              {/* Recent rides */}
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                  <Activity size={14} /> Recent rides
                </h4>
                <div className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {data.rides.slice(0, 25).map((r) => (
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
                      <span className="truncate flex-1 font-medium">
                        {r.passengerName} · {r.pickup} → {r.dropoff}
                      </span>
                      <span className="font-black text-emerald-600">
                        ${Number(r.finalizedFare || r.fare || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {!data.rides.length && (
                    <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest py-8">
                      No recent rides
                    </p>
                  )}
                </div>
              </div>

              {/* Audit */}
              {!!data.audit?.length && (
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                    <FileText size={14} /> Moderation audit
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

export default Driver360Modal;
