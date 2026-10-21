import { Clock3, Globe, KeyRound, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';
import AdvancedSecurityMethods from '@/components/settings/AdvancedSecurityMethods.jsx';
import QrLoginPanel from '@/components/auth/QrLoginPanel.jsx';

function SecuritySettings({ onOpenSessions }) {
    const { t } = useLanguage();

    return (
        <div className="min-w-0 rounded-xl border border-line bg-white p-5 shadow-panel sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-blue-950 dark:text-blue-300">
                    <ShieldCheck size={20} />
                </div>

                <div>
                    <h2 className="m-0 font-display text-base font-bold text-ink dark:text-white">
                        {t('security')}
                    </h2>
                    <p className="mt-1 mb-0 text-xs text-muted">
                        {t('currentSessionSecurityDescription')}
                    </p>
                </div>
            </div>

            <div className="grid gap-2.5">
                <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <strong className="mb-1 block text-sm text-slate-800 dark:text-slate-100">
                            {t('authentication')}
                        </strong>
                        <span className="text-xs text-slate-500">
                            {t('jwtAuthenticationDescription')}
                        </span>
                    </div>
                    <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
                        {t('active')}
                    </span>
                </div>

                <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <KeyRound size={20} />
                    </div>
                    <div>
                        <strong className="mb-1 block text-sm text-slate-800 dark:text-slate-100">
                            {t('accessToken')}
                        </strong>
                        <span className="text-xs text-slate-500">
                            {t('accessTokenDescription')}
                        </span>
                    </div>
                    <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
                        JWT
                    </span>
                </div>

                <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <Clock3 size={20} />
                    </div>
                    <div>
                        <strong className="mb-1 block text-sm text-slate-800 dark:text-slate-100">
                            {t('refreshToken')}
                        </strong>
                        <span className="text-xs text-slate-500">
                            {t('refreshTokenDescription')}
                        </span>
                    </div>
                    <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
                        Enabled
                    </span>
                </div>

                <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700 max-[640px]:grid-cols-[40px_minmax(0,1fr)]">
                    <div className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <Globe size={20} />
                    </div>
                    <div>
                        <strong className="mb-1 block text-sm text-slate-800 dark:text-slate-100">
                            {t('sessionManagement')}
                        </strong>
                        <span className="text-xs text-slate-500">
                            {t('sessionManagementDescription')}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 max-[640px]:col-start-2 max-[640px]:justify-self-start dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        onClick={onOpenSessions}
                    >
                        {t('viewSessions')}
                    </button>
                </div>
            </div>
            <AdvancedSecurityMethods />
            <QrLoginPanel allowApprove approvalOnly />
        </div>
    );
}

export default SecuritySettings;