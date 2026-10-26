import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { notificationApi } from '@/api/notificationApi.js';
import socket from '@/socket/socket.js';

const formatDate = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function NotificationCenter({ userId, onOpenConversation }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [busyIds, setBusyIds] = useState(() => new Set());
    const seenNotificationIdsRef = useRef(new Set());

    const loadNotifications = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const response = await notificationApi.getHistory(30, 0);
            const loadedItems = Array.isArray(response.data?.data) ? response.data.data : [];
            loadedItems.forEach(item => seenNotificationIdsRef.current.add(String(item.id)));
            setItems(loadedItems);
            setUnreadCount(Math.max(0, Number(response.data?.unreadCount) || 0));
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Không thể tải thông báo.', { duration: 8000 });
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void loadNotifications();

        const handleNewNotification = notification => {
            if (!notification?.id || Number(notification.user_id) !== Number(userId)) return;
            const id = String(notification.id);
            if (seenNotificationIdsRef.current.has(id)) return;
            seenNotificationIdsRef.current.add(id);
            setItems(previous => [notification, ...previous].slice(0, 30));
            if (!notification.is_read) setUnreadCount(previous => previous + 1);
        };
        const handleWindowFocus = () => void loadNotifications();

        socket.on('notification:new', handleNewNotification);
        window.addEventListener('focus', handleWindowFocus);
        return () => {
            socket.off('notification:new', handleNewNotification);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [loadNotifications, userId]);

    useEffect(() => {
        if (open) void loadNotifications();
    }, [open, loadNotifications]);

    const markRead = async (item) => {
        if (item.is_read) return true;
        setBusyIds(previous => new Set(previous).add(String(item.id)));
        try {
            await notificationApi.markRead(item.id);
            setItems(previous => previous.map(current => String(current.id) === String(item.id)
                ? { ...current, is_read: true, read_at: current.read_at || new Date().toISOString() }
                : current));
            setUnreadCount(count => Math.max(0, count - 1));
            return true;
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Không thể đánh dấu đã đọc.', { duration: 8000 });
            return false;
        } finally {
            setBusyIds(previous => {
                const next = new Set(previous);
                next.delete(String(item.id));
                return next;
            });
        }
    };

    const deleteNotification = async (item) => {
        setBusyIds(previous => new Set(previous).add(String(item.id)));
        try {
            await notificationApi.deleteNotification(item.id);
            setItems(previous => previous.filter(current => String(current.id) !== String(item.id)));
            if (!item.is_read) setUnreadCount(count => Math.max(0, count - 1));
            toast.success('Đã xóa thông báo.', { duration: 3000 });
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Không thể xóa thông báo.', { duration: 8000 });
        } finally {
            setBusyIds(previous => {
                const next = new Set(previous);
                next.delete(String(item.id));
                return next;
            });
        }
    };

    const markAllRead = async () => {
        try {
            await notificationApi.markAllRead();
            setItems(previous => previous.map(item => ({ ...item, is_read: true, read_at: item.read_at || new Date().toISOString() })));
            setUnreadCount(0);
            toast.success('Đã đánh dấu tất cả là đã đọc.', { duration: 3000 });
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Không thể cập nhật thông báo.', { duration: 8000 });
        }
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(value => !value)}
                className="relative inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Thông báo"
                aria-expanded={open}
                title="Thông báo"
            >
                <Bell size={18} />
                {unreadCount > 0 && <span className="absolute -right-1 -top-1 inline-flex min-w-5 max-w-none items-center justify-center whitespace-nowrap rounded-full bg-rose-500 px-1.5 text-center text-[10px] font-bold leading-5 tabular-nums text-white shadow-sm ring-2 ring-white dark:ring-slate-900" aria-label={`${unreadCount} thông báo chưa đọc`} title={`${unreadCount} thông báo chưa đọc`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {open && (
                <section className="absolute right-0 top-12 z-[100] flex max-h-[min(75dvh,560px)] w-[min(92vw,390px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" aria-label="Trung tâm thông báo">
                    <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Thông báo</h2>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{unreadCount} chưa đọc</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => void markAllRead()} disabled={unreadCount === 0 || loading} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700 disabled:opacity-40 dark:hover:bg-slate-800" title="Đánh dấu tất cả đã đọc" aria-label="Đánh dấu tất cả đã đọc"><CheckCheck size={17} /></button>
                            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Đóng trung tâm thông báo"><X size={17} /></button>
                        </div>
                    </header>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {loading ? (
                            <p className="p-6 text-center text-sm text-slate-500">Đang tải thông báo…</p>
                        ) : items.length === 0 ? (
                            <p className="p-6 text-center text-sm text-slate-500">Bạn chưa có thông báo nào.</p>
                        ) : items.map(item => (
                            <article key={item.id} className={`group flex gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 dark:border-slate-800 ${item.is_read ? '' : 'bg-blue-50/70 dark:bg-blue-950/20'}`}>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!item.is_read && !(await markRead(item))) return;
                                        if (item.conversation_id) {
                                            onOpenConversation?.(item.conversation_id);
                                            setOpen(false);
                                        }
                                    }}
                                    className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title || 'Thông báo'}</span>
                                    <span className="mt-1 block text-sm leading-5 text-slate-600 dark:text-slate-300">{item.body || 'Bạn có một thông báo mới.'}</span>
                                    <span className="mt-1.5 block text-[11px] text-slate-400">{formatDate(item.created_at)}{item.is_read ? ' · Đã đọc' : ' · Chưa đọc'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void deleteNotification(item)}
                                    disabled={busyIds.has(String(item.id))}
                                    className="self-start rounded-lg p-2 text-slate-400 opacity-70 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-red-950/30"
                                    aria-label="Xóa thông báo"
                                    title="Xóa thông báo"
                                ><Trash2 size={16} /></button>
                            </article>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
