import { useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Mail, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { uploadAvatarApi } from '@/api/profileApi.js';
import { resolveMediaUrl } from '@/utils/mediaUrl.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

function AccountSettings({
    user,
    form,
    onChange,
    onSubmit,
    saving,
    message,
    error,
    onAvatarUpdated,
}) {
    const { t } = useLanguage();
    const avatarInputRef = useRef(null);
    const [avatarSaving, setAvatarSaving] = useState(false);
    const [avatarMessage, setAvatarMessage] = useState('');

    const handleAvatarChange = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error(t('avatarFormatError'));
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error(t('avatarSizeError'));
            return;
        }

        setAvatarSaving(true);
        setAvatarMessage('');

        try {
            const result = await uploadAvatarApi(file);

            if (result.user) {
                onAvatarUpdated?.(result.user);
            }

            setAvatarMessage(t('avatarUpdated'));
            toast.success(t('avatarUpdateSuccess'));
        } catch (error) {
            toast.error(
                error.response?.data?.message || t('avatarUpdateFailed'),
            );
        } finally {
            setAvatarSaving(false);
        }
    };

    return (
        <div className="min-w-0 rounded-xl border border-line bg-white p-5 shadow-panel sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-blue-950 dark:text-blue-300">
                    <User size={20} />
                </div>

                <div>
                    <h2 className="m-0 font-display text-base font-bold text-ink dark:text-white">
                        {t('accountInformation')}
                    </h2>
                    <p className="mt-1 mb-0 text-xs text-muted">
                        {t('updateAccountDescription')}
                    </p>
                </div>
            </div>

            <div className="mb-5 flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                {user?.avatar_url || user?.avatar ? (
                    <img
                        src={resolveMediaUrl(user.avatar_url || user.avatar)}
                        alt={t('accountAvatar')}
                        className="h-16 w-16 rounded-full object-cover ring-2 ring-white dark:ring-slate-700"
                    />
                ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                        {(user?.full_name || user?.username || 'U').slice(0, 1).toUpperCase()}
                    </div>
                )}

                <div className="min-w-0 flex-1">
                    <p className="m-0 text-sm font-semibold text-slate-900 dark:text-white">
                        {t('avatar')}
                    </p>
                    <p className="mt-1 mb-3 text-xs text-slate-500">
                        JPEG, PNG hoặc WebP · tối đa 5 MB
                    </p>

                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleAvatarChange}
                    />

                    <button
                        type="button"
                        disabled={avatarSaving}
                        onClick={() => avatarInputRef.current?.click()}
                        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                        <ImagePlus size={16} />
                        {avatarSaving ? t('uploading') : t('changeAvatar')}
                    </button>

                    {avatarMessage && (
                        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                            {avatarMessage}
                        </p>
                    )}
                </div>
            </div>

            <form className="grid gap-4" onSubmit={onSubmit} noValidate>
                <div className="grid gap-2">
                    <label
                        htmlFor="account-username"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                        {t('username')}
                    </label>

                    <div className="flex min-h-[46px] items-center gap-2.5 rounded-lg border border-line bg-slate-50 px-3 transition focus-within:border-brand-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950">
                        <User size={17} className="shrink-0 text-slate-400" />
                        <input
                            id="account-username"
                            className="min-w-0 flex-1 cursor-not-allowed border-0 bg-transparent text-sm text-slate-500 outline-none dark:text-slate-400"
                            type="text"
                            value={form.username || ''}
                            readOnly
                            aria-describedby="account-username-help"
                        />
                    </div>
                    <p id="account-username-help" className="m-0 text-xs text-slate-500 dark:text-slate-400">
                        Username là định danh đăng nhập và không thể đổi tại mục thông tin cá nhân.
                    </p>
                </div>

                <div className="grid gap-2">
                    <label
                        htmlFor="account-full-name"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                        Tên hiển thị
                    </label>
                    <div className="flex min-h-[46px] items-center gap-2.5 rounded-lg border border-line bg-white px-3 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950">
                        <User size={17} className="shrink-0 text-slate-400" />
                        <input
                            id="account-full-name"
                            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100"
                            type="text"
                            autoComplete="name"
                            maxLength={120}
                            aria-invalid={Boolean(error)}
                            value={form.full_name || ''}
                            onChange={(event) => onChange({ ...form, full_name: event.target.value })}
                            required
                        />
                    </div>
                    <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                        Tên hiển thị không làm thay đổi username dùng để đăng nhập.
                    </p>
                </div>

                <div className="grid gap-2">
                    <label
                        htmlFor="account-email"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                        {t('email')}
                    </label>

                    <div className="flex min-h-[46px] items-center gap-2.5 rounded-lg border border-line bg-slate-50 px-3 transition focus-within:border-brand-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950">
                        <Mail size={17} className="shrink-0 text-slate-400" />
                        <input
                            id="account-email"
                            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100"
                            type="email"
                            autoComplete="email"
                            aria-invalid={Boolean(error)}
                            maxLength={254}
                            value={form.email}
                            onChange={(event) =>
                                onChange({ ...form, email: event.target.value })
                            }
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-800">
                        <span className="mb-1 block text-xs text-slate-500">
                            {t('role')}
                        </span>
                        <strong className="break-words text-sm text-slate-800 dark:text-slate-100">
                            {user?.role || 'user'}
                        </strong>
                    </div>

                    <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-800">
                        <span className="mb-1 block text-xs text-slate-500">
                            {t('userId')}
                        </span>
                        <strong className="break-words text-sm text-slate-800 dark:text-slate-100">
                            {user?.id || user?.userId || '—'}
                        </strong>
                    </div>
                </div>

                {error && (
                    <div role="alert" aria-live="polite" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                        {error}
                    </div>
                )}

                {message && (
                    <div
                        role="status"
                        className="flex items-center gap-2 rounded-md bg-green-50 px-3.5 py-3 text-xs text-green-800 dark:bg-green-950/40 dark:text-green-200"
                    >
                        <CheckCircle2 size={17} />
                        {message}
                    </div>
                )}

                <div className="mt-1 flex justify-end">
                    <button
                        type="submit"
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-linear-to-r from-brand-600 to-brand-500 px-4 text-xs font-semibold text-white shadow-md shadow-brand-600/20 hover:-translate-y-px hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={saving}
                    >
                        <Save size={17} />
                        {saving ? t('saving') : t('saveChanges')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AccountSettings;