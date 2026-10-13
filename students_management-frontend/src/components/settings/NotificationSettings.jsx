import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Volume2, VolumeX, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { enableWebPush, disableWebPush, notificationApi } from '@/api/notificationApi';

const OPTIONS = [
    { key: 'in_app_enabled', title: 'Thông báo trong ứng dụng', description: 'Hiển thị thông báo khi đang sử dụng Student Management', icon: Bell },
    { key: 'push_enabled', title: 'Thông báo đẩy trên trình duyệt', description: 'Nhận thông báo khi tab chat không mở ở phía trước', icon: Smartphone },
    { key: 'sound_enabled', title: 'Âm thanh thông báo', description: 'Phát âm báo khi có thông báo mới', icon: Volume2 }
];

export default function NotificationSettings() {
    const [preferences, setPreferences] = useState({
        in_app_enabled: true,
        push_enabled: true,
        sound_enabled: true
    });
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState('');

    useEffect(() => {
        let active = true;
        notificationApi.getPreferences()
            .then(({ data }) => {
                if (active && data?.data) setPreferences({
                    in_app_enabled: Boolean(data.data.in_app_enabled),
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
        <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-slate-900">Cài đặt thông báo</h2>
                <p className="mt-1 text-sm text-slate-500">Áp dụng cho tài khoản này. Bạn có thể tắt riêng thông báo ở từng cuộc trò chuyện.</p>
            </div>
            <div className="divide-y divide-slate-100">
                {OPTIONS.map(option => {
                    const Icon = option.icon;
                    const checked = Boolean(preferences[option.key]);
                    return (
                        <div key={option.key} className="flex items-center gap-4 py-4">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <Icon size={19} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900">{option.title}</p>
                                <p className="mt-1 text-xs text-slate-500">{option.description}</p>
                            </div>
                            <button
                                type="button"
                                disabled={loading || Boolean(savingKey)}
                                aria-label={option.title}
                                aria-pressed={checked}
                                onClick={() => toggle(option.key)}
                                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-wait disabled:opacity-50 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
                            >
                                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                    );
                })}
            </div>
            {!loading && preferences.push_enabled && Notification.permission === 'denied' && (
                <p className="mt-3 text-sm text-amber-700">Thông báo trình duyệt đang bị chặn trong cài đặt của trình duyệt.</p>
            )}
        </section>
    );
}
