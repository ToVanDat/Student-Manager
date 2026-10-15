import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AuthContext from './AuthContext.jsx';
import { getUserPreferences, updateUserPreferences } from '@/api/preferencesApi.js';
import viTranslations from '@/i18n/locales/vi/translation.json';
import enTranslations from '@/i18n/locales/en/translation.json';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'student-management-language';
const translations = { vi: viTranslations, en: enTranslations };

function readLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

export function LanguageProvider({ children }) {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const isAuthenticated = Boolean(auth?.isAuthenticated && user?.id);
  const [language, setLanguageState] = useState(readLanguage);

  // The account preference is authoritative after sign-in; localStorage is a startup cache.
  useEffect(() => {
    let active = true;
    if (!isAuthenticated) return () => { active = false; };

    getUserPreferences()
      .then((preferences) => {
        if (!active || !['vi', 'en'].includes(preferences?.preferredLanguage)) return;
        setLanguageState(preferences.preferredLanguage);
        try {
          localStorage.setItem(STORAGE_KEY, preferences.preferredLanguage);
        } catch {
          // The UI still works when storage is unavailable.
        }
      })
      .catch((error) => {
        console.warn('[PREFERENCES] Could not load account language; using local cache.', error.message);
      });

    return () => { active = false; };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // The UI still works when storage is unavailable.
    }
  }, [language]);

  const setLanguage = (nextLanguage) => {
    if (!['vi', 'en'].includes(nextLanguage)) return;
    setLanguageState(nextLanguage);
    try {
      localStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch {
      // The UI still works when storage is unavailable.
    }

    if (isAuthenticated) {
      updateUserPreferences({ preferredLanguage: nextLanguage }).catch((error) => {
        console.error(
          '[PREFERENCES] Could not save account language:',
          error.response?.data?.message || error.message
        );
      });
    }
  };

  const value = useMemo(() => ({
    language,
    setLanguage,
    // Keep Vietnamese as a fallback for untranslated keys during the migration.
    t: (key, options = {}) => {
      const template = translations[language]?.[key] ?? translations.vi[key] ?? key;
      return Object.entries(options).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value ?? '')),
        template
      );
    },
  }), [language, isAuthenticated, user?.id]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  // AuthProvider mounts the global CallPanel beside its children, so that panel
  // currently renders outside LanguageProvider. Keep it from crashing the whole
  // app; provider-backed components still use the selected account language.
  if (!context) {
    return {
      language: 'vi',
      setLanguage: () => {},
      t: (key, options = {}) => Object.entries(options).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value ?? '')),
        viTranslations[key] ?? key
      ),
    };
  }
  return context;
}
