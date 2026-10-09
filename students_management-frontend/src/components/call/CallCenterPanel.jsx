import { useEffect, useState } from 'react';
import { Phone, Video, PhoneMissed, Bell, X, CheckCheck } from 'lucide-react';
import { callApi } from '@/api/callApi.js';

const formatDuration = seconds => {
    const total = Math.max(Number(seconds) || 0, 0);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatTime = value =>
    value ? new Date(value).toLocaleString('vi-VN', {
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
    const [tab, setTab] = useState('history');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const historyResponse = await callApi.getHistory();
            setHistory(historyResponse.data?.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        load().catch(error => console.error('CALL CENTER LOAD ERROR:', error));
    }, [open]);

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
        <div className="fixed inset-0 z-[180] bg-slate-950/30 backdrop-blur-[2px]">
            <section className="absolute right-5 top-20 flex max-h-[calc(100vh-110px)] w-[420px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div>
                        <h2 className="font-semibold text-slate-900 dark:text-white">Cuộc gọi</h2>
                        <p className="text-xs text-slate-400">Lịch sử và thông báo cuộc gọi</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X size={18} />
                    </button>
                </header>

                <div className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => setTab('history')}
                        className={`px-4 py-3 text-sm font-medium ${tab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
                    >
                        Lịch sử
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('notifications')}
                        className={`relative px-4 py-3 text-sm font-medium ${tab === 'notifications' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
                    >
                        Thông báo
                        {unreadCount > 0 && (
                            <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {loading && (
                        <p className="py-8 text-center text-sm text-slate-400">Đang tải...</p>
                    )}

                    {!loading && tab === 'history' && history.length === 0 && (
                        <p className="py-8 text-center text-sm text-slate-400">Chưa có lịch sử cuộc gọi.</p>
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
                                        {missed ? 'Cuộc gọi nhỡ' : outgoing ? 'Cuộc gọi đi' : 'Cuộc gọi đến'}
                                        {item.status === 'completed' && ` · ${formatDuration(item.duration_seconds)}`}
                                    </p>
                                </div>
                                <span className="text-[10px] text-slate-400">{formatTime(item.started_at)}</span>
                            </div>
                        );
                    })}

                    {!loading && tab === 'notifications' && notifications.length === 0 && (
                        <p className="py-8 text-center text-sm text-slate-400">Không có thông báo mới.</p>
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
                                <span className="mt-1 block text-[10px] text-slate-400">{formatTime(item.created_at)}</span>
                            </span>
                            {item.is_read && <CheckCheck size={15} className="text-slate-400" />}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
