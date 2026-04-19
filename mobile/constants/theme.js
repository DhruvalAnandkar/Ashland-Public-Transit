import Constants from 'expo-constants';

// ─── MAPS KEY ────────────────────────────────────────────────────
// (Left intact — multiple screens already import this.)
const expoConfig = Constants.expoConfig || Constants.manifest || {};
const androidKey = expoConfig.android?.config?.googleMaps?.apiKey;
const iosKey = expoConfig.ios?.config?.googleMapsApiKey;

export const MAPS_KEY =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    androidKey ||
    iosKey ||
    '';

if (!MAPS_KEY) {
    console.warn(
        'MAPS_KEY is missing. Add a Google Maps Places API key to app.json or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.'
    );
}

// ─── COLOR TOKENS ────────────────────────────────────────────────
// The palette is the single source of truth for every screen that
// uses the ThemeContext. Screens that haven't been migrated yet will
// continue to use their hardcoded hex values — that's OK and safe.
//
// Naming convention is intentionally generic so screens don't have to
// know whether they're in light or dark mode:
//   bg         → screen background
//   surface    → elevated card / sheet
//   surfaceAlt → lighter/darker surface used for inputs, list rows
//   border     → dividers and input borders
//   text       → primary text
//   muted      → secondary / caption text
//   subtle     → tertiary / placeholder text
//   brand*     → Ashland brand blue family
//   success / warning / danger → semantic
//   overlay    → modal backdrops
//   shadow     → RGBA for StyleSheet shadowColor
//   statusBar  → "dark" | "light" style hint for expo-status-bar
export const Colors = {
    light: {
        bg: '#f8fafc',
        bgAlt: '#eff6ff',
        surface: '#ffffff',
        surfaceAlt: '#f1f5f9',
        border: '#e2e8f0',
        borderStrong: '#cbd5e1',
        text: '#0f172a',
        muted: '#475569',
        subtle: '#94a3b8',

        brand: '#1d4ed8',
        brandSoft: '#dbeafe',
        brandDeep: '#1e3a8a',
        accent: '#059669',

        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',

        overlay: 'rgba(15,23,42,0.45)',
        shadow: '#0f172a',
        statusBar: 'dark',

        // Hero gradients used on Auth/Home
        heroGradient: ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6'],
        cardGradient: ['#ffffff', '#f8fafc'],
    },
    dark: {
        bg: '#020617',
        bgAlt: '#0f172a',
        surface: '#0f172a',
        surfaceAlt: '#1e293b',
        border: '#1e293b',
        borderStrong: '#334155',
        text: '#f8fafc',
        muted: '#cbd5e1',
        subtle: '#64748b',

        brand: '#60a5fa',
        brandSoft: '#1e3a8a',
        brandDeep: '#1e40af',
        accent: '#10b981',

        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',

        overlay: 'rgba(0,0,0,0.7)',
        shadow: '#000000',
        statusBar: 'light',

        heroGradient: ['#020617', '#0b1220', '#0f172a', '#1e293b'],
        cardGradient: ['#0f172a', '#020617'],
    },
};

export default Colors;
