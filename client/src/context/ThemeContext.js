import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

/**
 * Three-way theme control: "light" | "dark" | "system".
 *   - "system" follows the OS `prefers-color-scheme` media query live.
 *   - User choice persists to localStorage under "theme-preference".
 *   - The effective (resolved) theme is written as a `dark` class on
 *     <html>, which Tailwind's class-based dark mode consumes.
 */

const STORAGE_KEY = "theme-preference";
const VALID = ["light", "dark", "system"];

const ThemeContext = createContext({
    preference: "system",
    resolved: "light",
    setPreference: () => {},
});

const getStoredPreference = () => {
    if (typeof window === "undefined") return "system";
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return VALID.includes(raw) ? raw : "system";
};

const getSystemTheme = () => {
    if (typeof window === "undefined" || !window.matchMedia) return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
};

const resolve = (preference) =>
    preference === "system" ? getSystemTheme() : preference;

const applyDocumentTheme = (resolved) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
};

export const ThemeProvider = ({ children }) => {
    const [preference, setPreferenceState] = useState(() =>
        getStoredPreference(),
    );
    const [resolved, setResolved] = useState(() => resolve(getStoredPreference()));

    // Apply theme class on mount and whenever `resolved` changes.
    useEffect(() => {
        applyDocumentTheme(resolved);
    }, [resolved]);

    // Recompute resolved theme when preference or OS-level scheme changes.
    useEffect(() => {
        const next = resolve(preference);
        setResolved(next);

        if (preference !== "system") return;
        if (typeof window === "undefined" || !window.matchMedia) return;

        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (e) => setResolved(e.matches ? "dark" : "light");
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [preference]);

    const setPreference = useCallback((next) => {
        if (!VALID.includes(next)) return;
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, next);
        }
        setPreferenceState(next);
    }, []);

    const value = useMemo(
        () => ({ preference, resolved, setPreference }),
        [preference, resolved, setPreference],
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
