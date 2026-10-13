import React, { useEffect, useState } from 'react';
import { Bell, Volume2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { enableWebPush, disableWebPush, notificationApi } from '@/api/notificationApi';

const OPTIONS = [
    { key: 'notifications_enabled', title: 'Thông báo trong ứng dụng', description: 'Hiển thị thông báo khi đang sử dụng Student Management', icon: Bell },
    { key: 'push_enabled', title: 'Thông báo đẩy trên trình duyệt', description: 'Nhận thông báo khi tab chat không mở ở phía trước', icon: Smartphone },
    { key: 'sound_enabled', title: 'Âm thanh thông báo', description: 'Phát âm báo khi có thông báo mới', icon: Volume2 }
];

export default function NotificationSettings() {
    const [preferences, setPreferences] = useState({
        notifications_enabled: true,
        push_enabled: false,
        sound_enabled: true
    });
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState('');

    useEffect(() => {
        let active = true;
        notificationApi.getPreferences()
            .then(({ data }) => {
                if (active && data?.data) setPreferences({
                    notifications_enabled: Boolean(data.data.notifications_enabled),
                    push_enabled: Boolean(data.data.push_enabled),
                    sound_enabled: Boolean(data.data.sound_enabled)
                });
            })
            .catch(error => toast.error(error.response?.data?.message || 'Không tải được cài đặt thông báo'))
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const toggle = async key => {
        const next = !preferences[key];
        setSavingKey(key);
        try {
            if (key === 'push_enabled') {
                if (next) await enableWebPush();
                else await disableWebPush();
            }
            const { data } = await notificationApi.updatePreferences({ [key]: next });
            setPreferences(previous => ({ ...previous, [key]: Boolean(data.data[key]) }));
            toast.success('Đã lưu cài đặt thông báo');
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Không thể cập nhật cài đặt');
        } finally {
            setSavingKey('');
        }
    };

    return (
        <section className="box-border w-full min-w-0 max-w-2xl overflow-visible rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-5 min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">Cài đặt thông báo</h2>
                <p className="mt-1 break-words text-sm text-slate-500">Áp dụng cho tài khoản này. Bạn có thể tắt riêng thông báo ở từng cuộc trò chuyện.</p>
            </div>
            <div className="min-w-0 divide-y divide-slate-100">
                {OPTIONS.map(option => {
                    const Icon = option.icon;
                    const checked = Boolean(preferences[option.key]);
                    return (
                        <div key={option.key} className="flex min-w-0 items-start gap-3 py-4 sm:items-center sm:gap-4">
                            <span className="group/icon relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <Icon size={19} aria-hidden="true" />
                                <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[min(13rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/icon:opacity-100 group-focus-within/icon:opacity-100">
                                    {option.title}
                                </span>
                            </span>
                            <div className="min-w-0 flex-1 break-words">
                                <p className="text-sm font-medium text-slate-900">{option.title}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
                            </div>
                            <span className="group/switch relative ml-auto shrink-0 pt-1 sm:ml-0 sm:pt-0">
                                <button
                                    type="button"
                                    role="switch"
                                    disabled={loading || Boolean(savingKey)}
                                    aria-label={option.title}
                                    aria-checked={checked}
                                    aria-busy={savingKey === option.key}
                                    onClick={() => toggle(option.key)}
                                    className={`relative inline-flex h-6 w-11 min-w-[2.75rem] shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
                                >
                                    <span className="sr-only">{option.title}</span>
                                    <span
                                        aria-hidden="true"
                                        className={`pointer-events-none inline-block h-5 w-5 shrink-0 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                                <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-max max-w-[min(13rem,calc(100vw-2rem))] rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/switch:opacity-100 group-focus-within/switch:opacity-100">
                                    {option.title}: {checked ? 'Đang bật' : 'Đang tắt'}
                                </span>
                            </span>
                        </div>
                    );
                })}
            </div>
            {!loading && preferences.push_enabled && typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
                <p className="mt-3 break-words text-sm text-amber-700">Thông báo trình duyệt đang bị chặn trong cài đặt của trình duyệt.</p>
            )}
        </section>
    );
}
