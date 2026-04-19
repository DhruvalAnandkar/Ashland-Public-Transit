import React from "react";
import { motion } from "framer-motion";
import { Bus } from "lucide-react";

/**
 * Primary brand lockup for Ashland Public Transit.
 *
 * Renders the exact same mark used in the landing-page navbar so
 * every surface on the site shares one consistent identity:
 *   • rounded blue→indigo gradient tile
 *   • white Bus glyph
 *   • two-line wordmark (ASHLAND / Transit)
 *
 * Props:
 *   - size: 'sm' | 'md' | 'lg'  — mark + type scale
 *   - showWordmark: boolean     — hide the text for tight surfaces
 *   - animate: boolean          — enable the playful hover-tilt
 *   - className: string         — extra layout classes on the outer span
 */
const SIZE_MAP = {
    sm: {
        tile: "w-7 h-7 rounded-lg",
        icon: 14,
        eyebrow: "text-[9px]",
        word: "text-sm",
        gap: "gap-2",
    },
    md: {
        tile: "w-9 h-9 rounded-xl",
        icon: 17,
        eyebrow: "text-[10px]",
        word: "text-base",
        gap: "gap-2.5",
    },
    lg: {
        tile: "w-12 h-12 rounded-2xl",
        icon: 22,
        eyebrow: "text-[11px]",
        word: "text-xl",
        gap: "gap-3",
    },
};

// Tone controls the wordmark palette so the same mark reads on any
// background surface without each consumer having to override utilities.
//   'auto'   — light mode: dark text · dark mode: light text (default)
//   'onDark' — always light text (for dark footers, hero overlays)
//   'onLight'— always dark text (for printed / pale backgrounds)
const TONE_MAP = {
    auto: {
        eyebrow: "text-blue-600/80 dark:text-blue-300/80",
        word: "text-slate-800 dark:text-slate-100",
    },
    onDark: {
        eyebrow: "text-blue-300",
        word: "text-white",
    },
    onLight: {
        eyebrow: "text-blue-600/80",
        word: "text-slate-800",
    },
};

const BrandLogo = ({
    size = "md",
    showWordmark = true,
    animate = true,
    tone = "auto",
    className = "",
}) => {
    const s = SIZE_MAP[size] || SIZE_MAP.md;
    const t = TONE_MAP[tone] || TONE_MAP.auto;

    const Tile = animate ? motion.div : "div";
    const tileProps = animate
        ? {
            whileHover: { rotate: -8, scale: 1.06 },
            transition: { type: "spring", stiffness: 340, damping: 16 },
        }
        : {};

    return (
        <span className={`inline-flex items-center ${s.gap} ${className}`}>
            <Tile
                {...tileProps}
                className={`${s.tile} bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white shadow-[0_8px_18px_rgba(37,99,235,0.32)] flex items-center justify-center`}
                aria-hidden="true"
            >
                <Bus size={s.icon} strokeWidth={2.6} />
            </Tile>
            {showWordmark && (
                <span className="leading-none select-none">
                    <span
                        className={`block ${s.eyebrow} ${t.eyebrow} font-black uppercase tracking-[0.22em]`}
                    >
                        Ashland
                    </span>
                    <span
                        className={`block ${s.word} ${t.word} font-black tracking-tight -mt-0.5`}
                    >
                        Transit
                    </span>
                </span>
            )}
        </span>
    );
};

export default BrandLogo;
