import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useAppTheme } from '../context/ThemeContext';

// Small inner component so we can read the resolved theme from context
// and drive the StatusBar style accordingly.
function ThemedShell() {
    const { resolved } = useAppTheme();
    return (
        <>
            <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
            <Slot />
        </>
    );
}

export default function Layout() {
    return (
        <ThemeProvider>
            <ThemedShell />
        </ThemeProvider>
    );
}
