import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext.jsx';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function AppearanceSettings() {
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();
    const options = [
        { value: 'light', title: t('light'), description: t('lightThemeDescription'), Icon: Sun },
        { value: 'dark', title: t('dark'), description: t('darkThemeDescription'), Icon: Moon },
        { value: 'system', title: t('system'), description: t('systemThemeDescription'), Icon: Monitor },
    ];

    return (
        <section className="min-w-0 rounded-xl border border-line bg-white p-5 shadow-panel sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 border-b border-slate-100 pb-5 dark:border-slate-800">
                <h2 className="m-0 text-base font-bold text-ink dark:text-white">{t('appearance')}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('chooseAppearanceDescription')}</p>
            </div>
            <div className="grid gap-3">
                {options.map(({ value, title, description, Icon }) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setTheme(value)}
                        aria-pressed={theme === value}
                        className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${theme === value ? 'border-brand-500 bg-brand-50 dark:border-blue-500 dark:bg-blue-950/40' : 'border-line bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'} `}
                    >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><Icon size={19} /></span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{description}</span>
                        </span>
                        <span className={`size-4 rounded-full border-2 ${theme === value ? 'border-brand-600 bg-brand-600 ring-2 ring-brand-100 dark:border-blue-400 dark:bg-blue-400' : 'border-slate-300 dark:border-slate-600'}`} />
                    </button>
                ))}
            </div>
        </section>
    );
}
