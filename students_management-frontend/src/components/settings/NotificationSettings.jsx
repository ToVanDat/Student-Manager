import React, { useEffect, useState } from 'react';
import { Bell, Volume2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { enableWebPush, disableWebPush, notificationApi } from '@/api/notificationApi';
import { useLanguage } from '@/context/LanguageContext.jsx';

const OPTIONS = [
    { key: 'notifications_enabled', titleKey: 'inAppNotifications', descriptionKey: 'inAppNotificationsDescription', icon: Bell },
    { key: 'push_enabled', titleKey: 'browserPushNotifications', descriptionKey: 'browserPushNotificationsDescription', icon: Smartphone },
    { key: 'sound_enabled', titleKey: 'notificationSounds', descriptionKey: 'notificationSoundsDescription', icon: Volume2 }
];

export default function NotificationSettings() {
    const { t } = useLanguage();
    const [preferences, setPreferences] = useState({
        notifications_enabled: true,
        push_enabled: false,
        sound_enabled: true,
        preview_mode: 'content'
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
                    sound_enabled: Boolean(data.data.sound_enabled),
                    preview_mode: ['content', 'sender', 'hidden'].includes(data.data.preview_mode) ? data.data.preview_mode : 'content'
                });
            })
            .catch(error => toast.error(error.response?.data?.message || t('loadNotificationSettingsFailed')))
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
            setPreferences(previous => ({ ...previous, [key]: key === 'preview_mode' ? data.data.preview_mode : Boolean(data.data[key]) }));
            toast.success(t('notificationSettingsSaved'));
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || t('updateSettingsFailed'));
        } finally {
            setSavingKey('');
        }
    };

    return (
        <section className="box-border w-full min-w-0 max-w-2xl overflow-visible rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm sm:p-5">
            <div className="mb-5 min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('notificationSettings')}</h2>
                <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">{t('notificationSettingsDescription')}</p>
            </div>
            <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
               <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('notificationPreviewContent')}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('notificationPreviewDescription')}</p>
                <div className="mt-3 grid gap-2">
                    {[
                        { value: 'content', label: t('showMessageContent') },
                        { value: 'sender', label: t('showSenderOnly') },
                        { value: 'hidden', label: t('hideMessageAndSender') }
                    ].map(option => (
                        <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                            <input type="radio" name="notification-preview-mode" value={option.value} checked={preferences.preview_mode === option.value} disabled={loading || Boolean(savingKey)} onChange={async () => {
                                setSavingKey('preview_mode');
                                try {
                                    const { data } = await notificationApi.updatePreferences({ preview_mode: option.value });
                                    setPreferences(previous => ({ ...previous, preview_mode: data.data.preview_mode }));
                                    toast.success(t('notificationPreviewSaved'));
                                } catch (error) {
                                    toast.error(error.response?.data?.message || error.message || 'Không thể cập nhật cài đặt');
                                } finally { setSavingKey(''); }
                            }} />
                            {option.label}
                        </label>
                    ))}
                </div>
            </div>
            <div className="min-w-0 divide-y divide-slate-100 dark:divide-slate-800">
                {OPTIONS.map(option => {
                    const Icon = option.icon;
                    const checked = Boolean(preferences[option.key]);
                    return (
                        <div key={option.key} className="flex min-w-0 items-start gap-3 py-4 sm:items-center sm:gap-4">
                            <span className="group/icon relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300">
                                <Icon size={19} aria-hidden="true" />
                                <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[min(13rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/icon:opacity-100 group-focus-within/icon:opacity-100">
                                    {t(option.titleKey)}
                                </span>
                            </span>
                            <div className="min-w-0 flex-1 break-words">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t(option.titleKey)}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t(option.descriptionKey)}</p>
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
                                    {option.title}: {checked ? t('enabled') : t('disabled')}
                                </span>
                            </span>
                        </div>
                    );
                })}
            </div>
            {!loading && preferences.push_enabled && typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
                <p className="mt-3 break-words text-sm text-amber-700">{t('browserNotificationsBlocked')}</p>
            )}
        </section>
    );
}
