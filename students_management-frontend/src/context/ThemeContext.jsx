import { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
    const [theme, setTheme] = useState(readInitialTheme);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        root.dataset.theme = theme;
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Theme still works for this tab when storage is unavailable.
        }
    }, [theme]);

    const value = useMemo(() => ({
        theme,
        isDarkMode: theme === 'dark',
        setTheme,
        toggleTheme: () => setTheme(current => current === 'dark' ? 'light' : 'dark')
    }), [theme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme phải được sử dụng bên trong ThemeProvider');
    return context;
}
