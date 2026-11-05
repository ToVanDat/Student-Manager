import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, Video, PhoneMissed, Bell, X, CheckCheck } from 'lucide-react';
import { callApi } from '@/api/callApi.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

const formatDuration = seconds => {
    const total = Math.max(Number(seconds) || 0, 0);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatTime = (value, language = 'vi') =>
    value ? new Date(value).toLocaleString(language === 'en' ? 'en-US' : 'vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }) : '';

export default function CallCenterPanel({
    open,
    onClose,
    currentUserId,
    notifications = [],
    onMarkNotificationRead
}) {
    const { t, language } = useLanguage();
    const [tab, setTab] = useState('history');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const closeButtonRef = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const historyResponse = await callApi.getHistory();
            setHistory(historyResponse.data?.data || []);
        } catch (error) {
            setLoadError(error?.response?.data?.message || t('callHistoryLoadError'));
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const previouslyFocused = document.activeElement;
        closeButtonRef.current?.focus();
        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose?.();
                return;
            }
            if (event.key !== 'Tab') return;
            const panel = closeButtonRef.current?.closest('[role="dialog"]');
            const focusable = panel ? [...panel.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')] : [];
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        load().catch(error => console.error('CALL CENTER LOAD ERROR:', error));
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [open, onClose, load]);

    const unreadCount = notifications.filter(item => !item.is_read).length;

    const markRead = async notificationId => {
        try {
            await onMarkNotificationRead?.(notificationId);
        } catch (error) {
            console.error('MARK CALL NOTIFICATION READ ERROR:', error);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[180] bg-slate-950/35" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="call-center-title" aria-describedby="call-center-description" className="absolute inset-x-3 top-16 mx-auto flex max-h-[calc(100dvh-80px)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_18px_48px_rgba(15,23,42,.22)] sm:inset-x-auto sm:right-5 sm:top-20 sm:max-h-[calc(100dvh-110px)] dark:bg-slate-900">
                <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div>
                        <h2 id="call-center-title" className="font-semibold text-slate-900 dark:text-white">{t('calls')}</h2>
                        <p id="call-center-description" className="text-xs text-slate-400">{t('callHistoryAndNotifications')}</p>
                    </div>
                    <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={t("closeCallHistory")} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800">
                        <X size={18} aria-hidden="true" />
                    </button>
                </header>

                <div role="tablist" aria-label={t("callCenterTabs")} className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => setTab('history')}
                        role="tab"
                        id="call-history-tab"
                        aria-selected={tab === 'history'}
                        aria-controls="call-center-panel"
                        className={`min-h-11 px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${tab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
                    >
                        {t('callHistoryTab')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('notifications')}
                        role="tab"
                        id="call-notifications-tab"
                        aria-selected={tab === 'notifications'}
                        aria-controls="call-center-panel"
                        className={`relative min-h-11 px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${tab === 'notifications' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
                    >
                        {t('callNotificationsTab')}
                        {unreadCount > 0 && (
                            <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>

                <div id="call-center-panel" role="tabpanel" aria-labelledby={tab === 'history' ? 'call-history-tab' : 'call-notifications-tab'} aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto p-3">
                    {loadError && !loading && <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><p>{loadError}</p><button type="button" onClick={() => load().catch(error => console.error('CALL CENTER LOAD ERROR:', error))} className="mt-2 min-h-10 rounded-lg border border-rose-300 px-3 text-xs font-semibold hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-800 dark:hover:bg-rose-900/40">{t('retryLoading')}</button></div>}
                    {loading && (
                        <p className="py-8 text-center text-sm text-slate-400">{t('loading')}</p>
                    )}

                    {!loading && tab === 'history' && history.length === 0 && (
                        <p role="status" className="py-8 text-center text-sm text-slate-400">{t('noCallHistory')}</p>
                    )}

                    {!loading && tab === 'history' && history.map(item => {
                        const outgoing = Number(item.caller_id) === Number(currentUserId);
                        const missed = item.status === 'missed' || item.status === 'timeout';
                        const video = item.call_type === 'video';
                        const otherName = outgoing ? item.receiver_username : item.caller_username;

                        return (
                            <div key={item.id} className="mb-2 flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${missed ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                                    {missed ? <PhoneMissed size={18} /> : video ? <Video size={18} /> : <Phone size={18} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{otherName || 'User'}</p>
                                    <p className="text-xs text-slate-500">
                                        {missed ? t('missedCall') : outgoing ? t('outgoingCall') : t('incomingCall')}
                                        {item.status === 'completed' && ` · ${formatDuration(item.duration_seconds)}`}
                                    </p>
                                </div>
                                <span className="text-[10px] text-slate-400">{formatTime(item.started_at, language)}</span>
                            </div>
                        );
                    })}

                    {!loading && tab === 'notifications' && notifications.length === 0 && (
                        <p role="status" className="py-8 text-center text-sm text-slate-400">{t('noNewNotifications')}</p>
                    )}

                    {!loading && tab === 'notifications' && notifications.map(item => (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => !item.is_read && markRead(item.id)}
                            className={`mb-2 flex w-full items-start gap-3 rounded-xl border p-3 text-left ${item.is_read ? 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900' : 'border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20'}`}
                        >
                            <Bell size={18} className="mt-0.5 shrink-0 text-blue-600" />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{item.body}</span>
                                <span className="mt-1 block text-[10px] text-slate-400">{formatTime(item.created_at, language)}</span>
                            </span>
                            {item.is_read && <CheckCheck size={15} className="text-slate-400" />}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
