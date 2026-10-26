import { Bell, KeyRound, Languages, Monitor, Moon, ShieldCheck, User } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

function SettingsMenu({ activeTab, onChange, activeSessions }) {
    const { t } = useLanguage();
    const items = [
        { id: 'account', label: t('account'), Icon: User },
        { id: 'notifications', label: t('notifications'), Icon: Bell },
        { id: 'security', label: t('security'), Icon: ShieldCheck },
        { id: 'sessions', label: t('sessions'), Icon: Monitor },
        { id: 'password', label: t('password'), Icon: KeyRound },
        { id: 'appearance', label: t('appearance'), Icon: Moon },
        { id: 'language', label: t('language'), Icon: Languages },
    ];

    return (
        <aside className="sticky top-5 grid gap-1 rounded-lg border border-line bg-white p-1.5 max-[900px]:static max-[900px]:grid-cols-2 max-[640px]:grid-cols-1 dark:border-slate-700 dark:bg-slate-900">
            {items.map(({ id, label, Icon }) => (
                <button
                    key={id}
                    type="button"
                    aria-current={activeTab === id ? 'page' : undefined}
                    className={`relative flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 ${activeTab === id ? 'bg-brand-50 text-brand-700 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-brand-600 dark:bg-blue-950/60 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                    onClick={() => onChange(id)}
                >
                    <Icon size={18} />
                    <span>{label}</span>
                    {id === 'sessions' && activeSessions > 0 && (
                        <span className="ml-auto inline-flex h-[21px] min-w-[21px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-200">{activeSessions}</span>
                    )}
                </button>
            ))}
        </aside>
    );
}

export default SettingsMenu;