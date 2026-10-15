import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AuthContext from './AuthContext.jsx';
import { getUserPreferences, updateUserPreferences } from '@/api/preferencesApi.js';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'student-management-theme';

function readInitialTheme() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved === 'dark' || saved === 'light' ? saved : 'light';
    } catch {
        return 'light';
    }
}

export function ThemeProvider({ children }) {
    const auth = useContext(AuthContext);
    const user = auth?.user;
    const isAuthenticated = Boolean(auth?.isAuthenticated && user?.id);
    const [theme, setThemeState] = useState(readInitialTheme);

    useEffect(() => {
        let active = true;
        if (!isAuthenticated) return () => { active = false; };

        getUserPreferences()
            .then((preferences) => {
                if (!active || !['light', 'dark'].includes(preferences?.theme)) return;
                setThemeState(preferences.theme);
                try { localStorage.setItem(STORAGE_KEY, preferences.theme); } catch { /* optional cache */ }
            })
            .catch((error) => {
                console.warn('[PREFERENCES] Could not load account theme; using local cache.', error?.message);
            });

        return () => { active = false; };
    }, [isAuthenticated, user?.id]);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        root.dataset.theme = theme;
        try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* optional cache */ }
    }, [theme]);

    const setTheme = (nextTheme) => {
        if (!['light', 'dark'].includes(nextTheme)) return;
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
        isDarkMode: theme === 'dark',
        setTheme,
        toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark')
    }), [theme, isAuthenticated, user?.id]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme phải được sử dụng bên trong ThemeProvider');
    return context;
}
