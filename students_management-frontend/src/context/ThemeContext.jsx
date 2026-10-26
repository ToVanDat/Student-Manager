import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import AuthContext from './AuthContext.jsx';
import { useLanguage } from './LanguageContext.jsx';
import { getUserPreferences, updateUserPreferences } from '@/api/preferencesApi.js';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'student-management-theme';
const VALID_THEMES = ['light', 'dark', 'system'];

function storageKeyForUser(userId) {
    return userId !== undefined && userId !== null && userId !== ''
        ? `${STORAGE_KEY}:${String(userId)}`
        : STORAGE_KEY;
}

function readCachedTheme(userId) {
    try {
        const saved = localStorage.getItem(storageKeyForUser(userId));
        return VALID_THEMES.includes(saved) ? saved : null;
    } catch {
        return null;
    }
}

function getInitialTheme(userId) {
    return readCachedTheme(userId) || 'system';
}

function getSystemTheme() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

function saveCachedTheme(userId, value) {
    try {
        localStorage.setItem(storageKeyForUser(userId), value);
    } catch {
        // Theme still works when browser storage is unavailable.
    }
}

export function ThemeProvider({ children }) {
    const auth = useContext(AuthContext);
    const user = auth?.user;
    const userId = user?.id;
    const { t } = useLanguage();
    const isAuthenticated = Boolean(auth?.isAuthenticated && userId !== undefined && userId !== null);
    const [theme, setThemeState] = useState(() => getInitialTheme(userId));
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);
    const themeRef = useRef(theme);
    const userIdRef = useRef(userId);
    const persistedThemeRef = useRef(theme);
    const persistedThemeUserIdRef = useRef(userId == null ? null : String(userId));
    const themeLoadSequenceRef = useRef(0);
    const themeSaveSequenceRef = useRef(0);
    const themeInteractionSequenceRef = useRef(0);
    const themeSaveQueueRef = useRef(Promise.resolve());

    themeRef.current = theme;
    userIdRef.current = userId;

    useEffect(() => {
        const media = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (!media) return undefined;

        const update = () => setSystemTheme(media.matches ? 'dark' : 'light');
        update();

        if (media.addEventListener) {
            media.addEventListener('change', update);
            return () => media.removeEventListener('change', update);
        }

        // Fallback for older browser implementations of MediaQueryList.
        media.addListener?.(update);
        return () => media.removeListener?.(update);
    }, []);

    useEffect(() => {
        let active = true;
        const loadSequence = ++themeLoadSequenceRef.current;
        const accountId = userId == null ? null : String(userId);

        if (!isAuthenticated || accountId === null) {
            const wasAuthenticatedAccount = persistedThemeUserIdRef.current !== null;
            persistedThemeUserIdRef.current = null;
            if (wasAuthenticatedAccount) {
                const guestTheme = getInitialTheme(null);
                persistedThemeRef.current = guestTheme;
                themeRef.current = guestTheme;
                setThemeState(guestTheme);
            }
            return () => {
                active = false;
            };
        }

        // Use only this account's cache while the server preference is loading.
        if (persistedThemeUserIdRef.current !== accountId) {
            const cachedTheme = getInitialTheme(userId);
            persistedThemeUserIdRef.current = accountId;
            persistedThemeRef.current = cachedTheme;
            themeRef.current = cachedTheme;
            setThemeState(cachedTheme);
        }

        const interactionAtRequestStart = themeInteractionSequenceRef.current;
        getUserPreferences()
            .then((preferences) => {
                const sameAccount = String(userIdRef.current) === accountId;
                const isCurrentLoad = loadSequence === themeLoadSequenceRef.current;
                const noNewerSelection = interactionAtRequestStart === themeInteractionSequenceRef.current;
                if (!active || !sameAccount || !isCurrentLoad || !noNewerSelection) return;
                if (!VALID_THEMES.includes(preferences?.theme)) return;

                persistedThemeRef.current = preferences.theme;
                persistedThemeUserIdRef.current = accountId;
                themeRef.current = preferences.theme;
                setThemeState(preferences.theme);
                saveCachedTheme(userId, preferences.theme);
            })
            .catch((error) => {
                if (active && String(userIdRef.current) === accountId) {
                    console.warn('[PREFERENCES] Could not load account theme; using this account cache.', error?.message);
                }
            });

        return () => {
            active = false;
        };
    }, [isAuthenticated, userId]);

    const effectiveTheme = theme === 'system' ? systemTheme : theme;

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', effectiveTheme === 'dark');
        root.dataset.theme = effectiveTheme;
        root.dataset.themePreference = theme;
        root.style.colorScheme = effectiveTheme;
    }, [theme, effectiveTheme]);

    const setTheme = useCallback((nextTheme) => {
        if (!VALID_THEMES.includes(nextTheme)) return;

        const requestId = ++themeSaveSequenceRef.current;
        ++themeInteractionSequenceRef.current;
        const requestUserId = userIdRef.current;
        const requestAccountId = requestUserId == null ? null : String(requestUserId);

        themeRef.current = nextTheme;
        setThemeState(nextTheme);
        saveCachedTheme(requestUserId, nextTheme);

        if (!isAuthenticated || requestAccountId === null) return;

        // Serialize same-field writes. Stale queued selections are skipped, while an
        // already-running save is followed by the newest selection so server state wins.
        themeSaveQueueRef.current = themeSaveQueueRef.current
            .catch(() => undefined)
            .then(async () => {
                if (requestId !== themeSaveSequenceRef.current) return;
                if (String(userIdRef.current) !== requestAccountId) return;

                try {
                    const savedPreferences = await updateUserPreferences({ theme: nextTheme });
                    if (String(userIdRef.current) === requestAccountId) {
                        const savedTheme = VALID_THEMES.includes(savedPreferences?.theme)
                            ? savedPreferences.theme
                            : nextTheme;
                        persistedThemeRef.current = savedTheme;
                        persistedThemeUserIdRef.current = requestAccountId;
                        saveCachedTheme(requestUserId, savedTheme);
                    }
                } catch (error) {
                    const isLatestRequest = requestId === themeSaveSequenceRef.current;
                    const sameAccount = String(userIdRef.current) === requestAccountId;
                    if (isLatestRequest && sameAccount) {
                        const rollbackTheme = persistedThemeUserIdRef.current === requestAccountId
                            ? persistedThemeRef.current
                            : getInitialTheme(requestUserId);
                        themeRef.current = rollbackTheme;
                        setThemeState(rollbackTheme);
                        saveCachedTheme(requestUserId, rollbackTheme);
                        toast.error(error?.response?.data?.message || t('userThemeSaveFailed'));
                    }
                    console.error(
                        '[PREFERENCES] Could not save account theme:',
                        error?.response?.data?.message || error?.message
                    );
                }
            });
    }, [isAuthenticated, t]);

    const toggleTheme = useCallback(() => {
        setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
    }, [effectiveTheme, setTheme]);

    const value = useMemo(() => ({
        theme,
        effectiveTheme,
        isDarkMode: effectiveTheme === 'dark',
        setTheme,
        toggleTheme
    }), [theme, effectiveTheme, setTheme, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme phải được sử dụng bên trong ThemeProvider');
    return context;
}
