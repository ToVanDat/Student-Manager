import { RefreshCw, Settings2 } from 'lucide-react';
import SettingsMenu from '@/components/settings/SettingsMenu.jsx';
import { useLanguage } from '@/context/LanguageContext.jsx';

function SettingsPage({ activeTab, onTabChange, activeSessions, loading, onRefresh, children }) {
    const { t } = useLanguage();
    return (
        <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-4 pb-8">
            <header className="flex min-w-0 items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/80 max-[640px]:flex-col">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <Settings2 size={21} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-[.14em] text-blue-700 dark:text-blue-300">{t('accountSecurity')}</span>
                        <h1 className="mt-1 mb-1 font-display text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-[29px]">{t('settingsTitle')}</h1>
                        <p className="m-0 max-w-2xl text-sm leading-5 text-slate-500 dark:text-slate-400">{t('settingsDescription')}</p>
                    </div>
                </div>
                {activeTab === 'sessions' && (
                    <button type="button" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" onClick={onRefresh} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{t('refresh')}
                    </button>
                )}
            </header>
            <div className="grid min-w-0 grid-cols-[minmax(220px,280px)_minmax(0,1fr)] items-start gap-5 max-[900px]:grid-cols-1 max-[900px]:gap-4">
                <SettingsMenu activeTab={activeTab} onChange={onTabChange} activeSessions={activeSessions} />
                <main className="min-w-0">{children}</main>
            </div>
        </div>
    );
}

export default SettingsPage;
