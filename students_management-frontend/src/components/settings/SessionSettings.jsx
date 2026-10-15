import { AlertCircle, CheckCircle2, LogOut, Monitor, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

function SessionSettings({
    sessions,
    loading,
    error,
    currentSessionId,
    onRefresh,
    onRevoke,
    onRevokeOthers,
    formatDate,
    getDeviceIcon,
}) {
    const { t } = useLanguage();
    const activeSessions = sessions.filter((session) => !session.revoked_at);
    const revokedSessions = sessions.filter((session) => session.revoked_at);

    return (
        <div className="min-w-0 rounded-xl border border-line bg-white p-5 shadow-panel sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-100 pb-5 max-[900px]:items-start max-[900px]:flex-col dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-blue-950 dark:text-blue-300"><Monitor size={20} /></div>
                    <div><h2 className="m-0 font-display text-base font-bold text-ink dark:text-white"{t('loginSessions')}</h2><p className="mt-1 mb-0 text-xs text-muted">{t('loginSessionsDescription')}</p></div>
                </div>
                <button className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" onClick={onRevokeOthers} disabled={loading || activeSessions.filter((session) => session.id !== currentSessionId).length === 0}>
                    <LogOut size={16} /{t('logoutOtherDevices')}
                </button>
            </div>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-canvas p-3 dark:border-slate-700 dark:bg-slate-800"><strong className="mb-1 block text-xl font-bold text-ink dark:text-white">{activeSessions.length}</strong><span className="text-xs text-muted"{t('activeSessions')}</span></div>
                <div className="rounded-lg border border-line bg-canvas p-3 dark:border-slate-700 dark:bg-slate-800"><strong className="mb-1 block text-xl font-bold text-ink dark:text-white">{revokedSessions.length}</strong><span className="text-xs text-muted"{t('revokedSessions')}</span></div>
                <div className="rounded-lg border border-line bg-canvas p-3 dark:border-slate-700 dark:bg-slate-800"><strong className="mb-1 block text-xl font-bold text-ink dark:text-white">{sessions.length}</strong><span className="text-xs text-muted"{t('totalSessions')}</span></div>
            </div>
            {error && <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 px-3.5 py-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-200"><AlertCircle size={18} />{error}</div>}
            {loading ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center text-sm text-slate-500"><div className="size-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" /><p>{t('loadingSessions')}</p></div>
            ) : sessions.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center text-center text-slate-500">
                    <Monitor size={42} className="text-slate-400" /><h3 className="mt-3 mb-1 text-sm font-bold text-slate-700 dark:text-slate-200"{t('noSessionData')}</h3><p className="mt-0 mb-4 text-xs">{t('noSessionsFound')}</p>
                    <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" onClick={onRefresh}><RefreshCw size={16} /{t('reload')}</button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {sessions.map((session) => {
                        const isCurrent = session.id === currentSessionId;
                        const isRevoked = Boolean(session.revoked_at);
                        const DeviceIcon = getDeviceIcon(session);

                        return (
                            <div className={`flex gap-4 rounded-lg border p-4 max-[640px]:flex-col dark:border-slate-700 ${isCurrent ? 'border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20' : 'border-slate-200 bg-slate-50/50 dark:bg-slate-900'} ${isRevoked ? 'opacity-60' : ''}`} key={session.id}>
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><DeviceIcon size={24} /></div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between gap-4 max-[900px]:flex-col">
                                        <div>
                                            <h3 className="mt-0 mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">{session.device_name || t('unknownDevice')}</h3>
                                            <div className="flex flex-wrap gap-1.5">
                                                {isCurrent && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200"><CheckCircle2 size={13} /{t('currentDevice')}</span>}
                                                {!isRevoked && !isCurrent && <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold text-green-800 dark:bg-green-950 dark:text-green-200"{t('active')}</span>}
                                                {isRevoked && <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-200"{t('revoked')}</span>}
                                            </div>
                                        </div>
                                        {!isCurrent && !isRevoked && <button className="inline-flex items-center justify-center gap-2 self-start rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" onClick={() => onRevoke(session.id)}><LogOut size={16} /{t('logout')}</button>}
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                                        <div><span className="mb-1 block text-xs text-slate-500"{t('browser')}</span><strong className="block break-words text-xs leading-relaxed text-slate-700 dark:text-slate-200">{session.user_agent || t('unknown')}</strong></div>
                                        <div><span className="mb-1 block text-xs text-slate-500"{t('ipAddress')}</span><strong className="block break-words text-xs leading-relaxed text-slate-700 dark:text-slate-200">{session.ip_address || 'Không xác định'}</strong></div>
                                        <div><span className="mb-1 block text-xs text-slate-500"{t('loggedInAt')}</span><strong className="block break-words text-xs leading-relaxed text-slate-700 dark:text-slate-200">{formatDate(session.created_at)}</strong></div>
                                        <div><span className="mb-1 block text-xs text-slate-500"{t('lastActive')}</span><strong className="block break-words text-xs leading-relaxed text-slate-700 dark:text-slate-200">{formatDate(session.last_used_at)}</strong></div>
                                        {isRevoked && <div><span className="mb-1 block text-xs text-slate-500"{t('revokedAt')}</span><strong className="block break-words text-xs leading-relaxed text-slate-700 dark:text-slate-200">{formatDate(session.revoked_at)}</strong></div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default SessionSettings;