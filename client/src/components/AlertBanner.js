import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, XCircle, Radio, Siren } from "lucide-react";

/**
 * AlertBanner
 * Renders a vertical stack of live operational alerts
 * (SOS, broadcasts, user actions, overbookings, etc.).
 */
const severityStyle = {
  critical: {
    bg: "bg-red-600",
    text: "text-white",
    Icon: Siren,
    label: "SOS",
  },
  warning: {
    bg: "bg-amber-500",
    text: "text-white",
    Icon: AlertTriangle,
    label: "Warning",
  },
  info: {
    bg: "bg-blue-600",
    text: "text-white",
    Icon: Radio,
    label: "Info",
  },
};

const AlertBanner = ({ alerts = [], onDismiss, onOpenDriver }) => {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      <AnimatePresence>
        {alerts.slice(0, 5).map((a) => {
          const sev = severityStyle[a.severity] || severityStyle.info;
          const Icon = sev.Icon;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30 }}
              className={`flex items-center gap-3 ${sev.bg} ${sev.text} rounded-2xl px-4 py-3 shadow-lg`}
            >
              <Icon
                size={20}
                className={a.severity === "critical" ? "animate-pulse" : ""}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
                  {a.type || sev.label}
                </div>
                <div className="font-black truncate">{a.message}</div>
                {a.driverUsername && (
                  <button
                    onClick={() => onOpenDriver?.(a.driverUsername)}
                    className="text-xs underline underline-offset-2 font-bold opacity-90 hover:opacity-100"
                  >
                    View driver · {a.driverUsername}
                  </button>
                )}
              </div>
              <button
                onClick={() => onDismiss?.(a.id)}
                className="p-1 rounded-lg hover:bg-black/20"
                aria-label="Dismiss"
              >
                <XCircle size={18} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default AlertBanner;
