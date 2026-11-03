import { useEffect, useState } from 'react';
import { Phone, Video, PhoneMissed, Bell, X, CheckCheck, RefreshCw } from 'lucide-react';
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

    const load = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const historyResponse = await callApi.getHistory();
            setHistory(historyResponse.data?.data || []);
        } catch (error) {
            setLoadError(error?.response?.data?.message || t('error'));
            throw error;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = event => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        callApi.getHistory()
            .then(response => {
                if (!cancelled) setHistory(response.data?.data || []);
            })
            .catch(error => {
                if (!cancelled) setLoadError(error?.response?.data?.message || t('error'));
                console.error('CALL CENTER LOAD ERROR:', error);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [open, t]);

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
        <div
            className="call-center-overlay fixed inset-0 z-[180] bg-slate-950/30 backdrop-blur-[2px]"
            onMouseDown={event => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <section
                className="call-center-dialog absolute right-5 top-20 flex max-h-[calc(100vh-110px)] w-[420px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                role="dialog"
                aria-modal="true"
                aria-labelledby="call-center-title"
                onMouseDown={event => event.stopPropagation()}
            >
                <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="min-w-0">
                        <h2 id="call-center-title" className="font-semibold text-slate-900 dark:text-white">{t('calls')}</h2>
                        <p className="text-xs text-slate-400">{t('callHistoryAndNotifications')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <button
                            type="button"
                            onClick={() => load().catch(() => {})}
                            disabled={loading}
                            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-slate-800"
                            aria-label="Làm mới lịch sử cuộc gọi"
                            title="Làm mới"
                        >
                            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                            aria-label="Đóng trung tâm cuộc gọi"
                            title="Đóng"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-800" role="tablist" aria-label="Nội dung cuộc gọi">
                    <button
                        type="button"
                        role="tab"
                        id="call-history-tab"
                        aria-controls="call-history-panel"
                        aria-selected={tab === 'history'}
                        onClick={() => setTab('history')}
                        className={`px-4 py-3 text-sm font-medium transition ${tab === 'history' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                    >
                        Lịch sử
                    </button>
                    <button
                        type="button"
                        role="tab"
                        id="call-notifications-tab"
                        aria-controls="call-notifications-panel"
                        aria-selected={tab === 'notifications'}
                        onClick={() => setTab('notifications')}
                        className={`relative px-4 py-3 text-sm font-medium transition ${tab === 'notifications' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                    >
                        Thông báo
                        {unreadCount > 0 && (
                            <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white" aria-label={`${unreadCount} thông báo chưa đọc`}>
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {loading && (
                        <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                            <RefreshCw size={15} className="animate-spin" />{t('loading')}
                        </p>
                    )}

                    {!loading && loadError && tab === 'history' && (
                        <div role="alert" className="mx-1 my-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-center dark:border-rose-900/60 dark:bg-rose-950/20">
                            <p className="text-sm text-rose-700 dark:text-rose-300">{loadError}</p>
                            <button type="button" onClick={() => load().catch(() => {})} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40">
                                <RefreshCw size={13} /> Thử lại
                            </button>
                        </div>
                    )}

                    {!loading && !loadError && tab === 'history' && history.length === 0 && (
                        <p className="py-10 text-center text-sm text-slate-400">{t('noCallHistory')}</p>
                    )}

                    {!loading && !loadError && tab === 'history' && history.map(item => {
                        const outgoing = Number(item.caller_id) === Number(currentUserId);
                        const missed = item.status === 'missed' || item.status === 'timeout';
                        const video = item.call_type === 'video';
                        const otherName = outgoing ? item.receiver_username : item.caller_username;

                        return (
                            <div key={item.id} className="mb-2 flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-blue-100 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${missed ? 'bg-red-50 text-red-500 dark:bg-red-950/40' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'}`}>
                                    {missed ? <PhoneMissed size={18} /> : video ? <Video size={18} /> : <Phone size={18} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{otherName || 'User'}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {missed ? t('missedCall') : outgoing ? t('outgoingCall') : t('incomingCall')}
                                        {item.status === 'completed' && ` · ${formatDuration(item.duration_seconds)}`}
                                    </p>
                                </div>
                                <span className="shrink-0 text-[10px] text-slate-400">{formatTime(item.started_at, language)}</span>
                            </div>
                        );
                    })}

                    {!loading && tab === 'notifications' && notifications.length === 0 && (
                        <p className="py-10 text-center text-sm text-slate-400">{t('noNewNotifications')}</p>
                    )}

                    {!loading && tab === 'notifications' && notifications.map(item => (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => !item.is_read && markRead(item.id)}
                            aria-label={item.is_read ? item.title : `${item.title}, chưa đọc`}
                            className={`mb-2 flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:border-blue-200 ${item.is_read ? 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900' : 'border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20'}`}
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
