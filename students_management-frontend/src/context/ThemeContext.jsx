import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AuthContext from './AuthContext.jsx';
import { getUserPreferences, updateUserPreferences } from '@/api/preferencesApi.js';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'student-management-theme';
const VALID_THEMES = ['light', 'dark', 'system'];

function readInitialTheme() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return VALID_THEMES.includes(saved) ? saved : 'system';
    } catch {
        return 'system';
    }
}

function getSystemTheme() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

export function ThemeProvider({ children }) {
    const auth = useContext(AuthContext);
    const user = auth?.user;
    const isAuthenticated = Boolean(auth?.isAuthenticated && user?.id);
    const [theme, setThemeState] = useState(readInitialTheme);
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);

    useEffect(() => {
        const media = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (!media) return undefined;
        const update = () => setSystemTheme(media.matches ? 'dark' : 'light');
        update();
        media.addEventListener?.('change', update);
        return () => media.removeEventListener?.('change', update);
    }, []);

    useEffect(() => {
        let active = true;
        if (!isAuthenticated) return () => { active = false; };
        getUserPreferences()
            .then((preferences) => {
                if (!active || !VALID_THEMES.includes(preferences?.theme)) return;
                setThemeState(preferences.theme);
                try { localStorage.setItem(STORAGE_KEY, preferences.theme); } catch { /* optional cache */ }
            })
            .catch((error) => {
                console.warn('[PREFERENCES] Could not load account theme; using local cache.', error?.message);
            });
        return () => { active = false; };
    }, [isAuthenticated, user?.id]);

    const effectiveTheme = theme === 'system' ? systemTheme : theme;

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', effectiveTheme === 'dark');
        root.dataset.theme = effectiveTheme;
        root.dataset.themePreference = theme;
        try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* optional cache */ }
    }, [theme, effectiveTheme]);

    const setTheme = (nextTheme) => {
        if (!VALID_THEMES.includes(nextTheme)) return;
        setThemeState(nextTheme);
        try { localStorage.setItem(STORAGE_KEY, nextTheme); } catch { /* optional cache */ }
        if (isAuthenticated) {
            updateUserPreferences({ theme: nextTheme }).catch((error) => {
                console.error('[PREFERENCES] Could not save account theme:', error.response?.data?.message || error.message);
            });
        }
    };

    const value = useMemo(() => ({
        theme,
        effectiveTheme,
        isDarkMode: effectiveTheme === 'dark',
        setTheme,
        toggleTheme: () => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')
    }), [theme, effectiveTheme, isAuthenticated, user?.id]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme phải được sử dụng bên trong ThemeProvider');
    return context;
}
