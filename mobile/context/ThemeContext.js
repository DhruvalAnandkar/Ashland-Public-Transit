import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { Colors } from '../constants/theme';

// Three-way control: 'light' | 'dark' | 'system'
// Persisted with expo-secure-store under the key below so the choice
// survives app kills. We also listen to OS-level color-scheme changes
// while the user's preference is 'system'.

const STORAGE_KEY = 'apt-theme-preference';
const VALID = ['light', 'dark', 'system'];

const ThemeContext = createContext({
    preference: 'system',
    resolved: 'light',
    colors: Colors.light,
    setPreference: () => { },
});

const resolve = (pref) => {
    if (pref === 'system') {
        const scheme = Appearance.getColorScheme();
        return scheme === 'dark' ? 'dark' : 'light';
    }
    return pref === 'dark' ? 'dark' : 'light';
};

export const ThemeProvider = ({ children }) => {
    const [preference, setPreferenceState] = useState('system');
    const [resolved, setResolved] = useState(() => resolve('system'));
    const [hydrated, setHydrated] = useState(false);

    // Hydrate from SecureStore on mount.
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const stored = await SecureStore.getItemAsync(STORAGE_KEY);
                if (mounted && VALID.includes(stored)) {
                    setPreferenceState(stored);
                    setResolved(resolve(stored));
                }
            } catch {
                // no-op: default is 'system'
            } finally {
                if (mounted) setHydrated(true);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Follow the OS color scheme only while preference === 'system'.
    useEffect(() => {
        if (preference !== 'system') return;
        const sub = Appearance.addChangeListener(({ colorScheme }) => {
            setResolved(colorScheme === 'dark' ? 'dark' : 'light');
        });
        return () => sub.remove();
    }, [preference]);

    // Keep the native root background in sync so the status bar edges /
    // splash tear do not flash light.
    useEffect(() => {
        const bg = Colors[resolved].bg;
        SystemUI.setBackgroundColorAsync(bg).catch(() => { });
    }, [resolved]);

    const setPreference = useCallback(async (next) => {
        if (!VALID.includes(next)) return;
        setPreferenceState(next);
        setResolved(resolve(next));
        try {
            await SecureStore.setItemAsync(STORAGE_KEY, next);
        } catch {
            // persistence failure is non-fatal
        }
    }, []);

    const value = useMemo(
        () => ({
            preference,
            resolved,
            colors: Colors[resolved],
            setPreference,
            isHydrated: hydrated,
        }),
        [preference, resolved, setPreference, hydrated],
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};

export const useAppTheme = () => useContext(ThemeContext);
