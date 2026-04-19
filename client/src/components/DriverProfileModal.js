import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    X,
    User,
    Lock,
    Mail,
    Phone,
    Shield,
    Save,
    Truck,
} from "lucide-react";
import { getMe, updateMyProfile, changePassword } from "../services/api";

/**
 * Driver profile + password modal.
 * Uses the authenticated `/api/auth/me` endpoints so it's safe for any role,
 * but we present it to the driver with driver-first fields.
 */
const DriverProfileModal = ({ onClose, onToast }) => {
    const [me, setMe] = useState(null);
    const [tab, setTab] = useState("profile");
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        licenseNumber: "",
    });

    const [pwd, setPwd] = useState({
        currentPassword: "",
        newPassword: "",
        confirm: "",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const u = await getMe();
                setMe(u);
                setForm({
                    firstName: u.firstName || "",
                    lastName: u.lastName || "",
                    email: u.email || "",
                    phoneNumber: u.phoneNumber || "",
                    licenseNumber: u.licenseNumber || "",
                });
            } catch {
                onToast?.("Unable to load profile.", "error");
            } finally {
                setLoading(false);
            }
        })();
    }, [onToast]);

    const saveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateMyProfile(form);
            onToast?.("Profile updated.", "success");
        } catch (err) {
            onToast?.(err?.response?.data?.message || "Update failed.", "error");
        } finally {
            setSaving(false);
        }
    };

    const savePwd = async (e) => {
        e.preventDefault();
        if (pwd.newPassword.length < 8) {
            return onToast?.("Password must be at least 8 characters.", "error");
        }
        if (pwd.newPassword !== pwd.confirm) {
            return onToast?.("Passwords do not match.", "error");
        }
        setSaving(true);
        try {
            await changePassword(pwd.currentPassword, pwd.newPassword);
            setPwd({ currentPassword: "", newPassword: "", confirm: "" });
            onToast?.("Password updated. Keep it safe.", "success");
        } catch (err) {
            onToast?.(err?.response?.data?.message || "Could not change password.", "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
                onClick={onClose}
            />
            <motion.div
                initial={{ scale: 0.94, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <Truck size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 leading-none">
                                Driver Account
                            </p>
                            <p className="text-base font-black leading-tight">
                                {me?.fullName || me?.username || "My Profile"}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex border-b border-slate-100">
                    {[
                        { id: "profile", label: "Profile", Icon: User },
                        { id: "password", label: "Password", Icon: Lock },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-widest transition-colors ${tab === t.id
                                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/30"
                                : "text-slate-500 hover:bg-slate-50"
                                }`}
                        >
                            <t.Icon size={13} />
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-5 max-h-[70vh] overflow-y-auto">
                    {loading ? (
                        <div className="h-32 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-400">
                            Loading…
                        </div>
                    ) : tab === "profile" ? (
                        <form onSubmit={saveProfile} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="First name"
                                    value={form.firstName}
                                    onChange={(v) => setForm({ ...form, firstName: v })}
                                />
                                <Input
                                    label="Last name"
                                    value={form.lastName}
                                    onChange={(v) => setForm({ ...form, lastName: v })}
                                />
                            </div>
                            <Input
                                label="Email"
                                icon={Mail}
                                value={form.email}
                                onChange={(v) => setForm({ ...form, email: v })}
                            />
                            <Input
                                label="Phone"
                                icon={Phone}
                                value={form.phoneNumber}
                                onChange={(v) => setForm({ ...form, phoneNumber: v })}
                            />
                            <Input
                                label="License #"
                                icon={Shield}
                                value={form.licenseNumber}
                                onChange={(v) => setForm({ ...form, licenseNumber: v })}
                            />
                            <div className="pt-2">
                                <button
                                    disabled={saving}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    <Save size={14} />
                                    {saving ? "Saving…" : "Save profile"}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={savePwd} className="space-y-3">
                            <Input
                                label="Current password"
                                type="password"
                                icon={Lock}
                                value={pwd.currentPassword}
                                onChange={(v) => setPwd({ ...pwd, currentPassword: v })}
                            />
                            <Input
                                label="New password"
                                type="password"
                                icon={Lock}
                                value={pwd.newPassword}
                                onChange={(v) => setPwd({ ...pwd, newPassword: v })}
                            />
                            <Input
                                label="Confirm new password"
                                type="password"
                                icon={Lock}
                                value={pwd.confirm}
                                onChange={(v) => setPwd({ ...pwd, confirm: v })}
                            />
                            <div className="pt-2">
                                <button
                                    disabled={saving}
                                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    <Lock size={14} />
                                    {saving ? "Updating…" : "Update password"}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 text-center pt-1">
                                Forgot it? Log out and tap "Forgot password" on sign-in.
                            </p>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

const Input = ({ label, value, onChange, type = "text", icon: Icon }) => (
    <label className="block">
        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
            {label}
        </span>
        <div className="relative">
            {Icon && (
                <Icon
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
            )}
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400`}
            />
        </div>
    </label>
);

export default DriverProfileModal;
