import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const styles = {
        success: { bg: 'bg-emerald-500/90', icon: CheckCircle, border: 'border-emerald-400' },
        error: { bg: 'bg-red-500/90', icon: AlertCircle, border: 'border-red-400' },
        info: { bg: 'bg-blue-500/90', icon: Info, border: 'border-blue-400' }
    };

    const style = styles[type] || styles.info;
    const Icon = style.icon;

    return (
        <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            layout
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-md border ${style.bg} ${style.border} text-white min-w-[300px] mb-2`}
        >
            <Icon size={20} className="shrink-0" />
            <p className="text-sm font-bold tracking-wide flex-1">{message}</p>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X size={14} />
            </button>
        </motion.div>
    );
};

export default Toast;
