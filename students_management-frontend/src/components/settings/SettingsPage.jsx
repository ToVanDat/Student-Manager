import { RefreshCw } from 'lucide-react';
import SettingsMenu from '@/components/settings/SettingsMenu.jsx';
import { useLanguage } from '@/context/LanguageContext.jsx';

function SettingsPage({ activeTab, onTabChange, activeSessions, loading, onRefresh, children }) {
    const { t } = useLanguage();
    return (
        <div className="settings-page mx-auto w-full max-w-[1500px] space-y-1 pb-8" data-ui-page="settings" aria-busy={loading}>
            <header className="settings-page__header mb-6 flex items-center justify-between gap-5 max-[640px]:items-start max-[640px]:flex-col">
                <div className="min-w-0">
                    <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight text-ink dark:text-white sm:text-[29px]">{t("settingsTitle")}</h1>
                    <p className="mt-2 mb-0 max-w-[65ch] text-sm leading-6 text-slate-600 dark:text-slate-300">{t("settingsDescription")}</p>
                </div>
                {activeTab === 'sessions' && (
                    <button className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-slate-700 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" onClick={onRefresh} disabled={loading}>
                        <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />{t('refresh')}
                    </button>
                )}
            </header>
            <div className="settings-page__layout grid grid-cols-[225px_minmax(0,1fr)] items-start gap-5 max-[900px]:grid-cols-1 max-[900px]:gap-4">
                <SettingsMenu activeTab={activeTab} onChange={onTabChange} activeSessions={activeSessions} />
                {children}
            </div>
        </div>
    );
}

export default SettingsPage;
