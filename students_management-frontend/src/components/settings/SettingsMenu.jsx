import { Bell, Database, KeyRound, MessageSquare, Moon, ShieldCheck, UserRound } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

function categoryForTab(tab) {
    if (tab === 'password') return 'account';
    if (tab === 'sessions') return 'security';
    if (tab === 'language') return 'appearance';
    return tab;
}

function SettingsMenu({ activeTab, onChange, activeSessions }) {
    const { t } = useLanguage();
    const activeCategory = categoryForTab(activeTab);
    const items = [
        { id: 'account', label: t('account'), description: t('accountSettingsGroupDescription') || 'Hồ sơ, mật khẩu và tài khoản liên kết', Icon: UserRound },
        { id: 'security', label: t('security'), description: t('securitySettingsGroupDescription') || 'Passkey, PIN, thiết bị và phiên đăng nhập', Icon: ShieldCheck },
        { id: 'chat', label: t('chatAndCalls') || 'Chat và cuộc gọi', description: t('chatSettingsGroupDescription') || 'Quyền riêng tư, khóa chat và cuộc gọi', Icon: MessageSquare },
        { id: 'notifications', label: t('notifications'), description: t('notificationSettingsGroupDescription') || 'Thông báo, âm thanh và bản xem trước', Icon: Bell },
        { id: 'appearance', label: t('appearanceAndLanguage') || 'Giao diện và ngôn ngữ', description: t('appearanceSettingsGroupDescription') || 'Chủ đề và ngôn ngữ hiển thị', Icon: Moon },
        { id: 'data', label: t('dataAndSupport') || 'Dữ liệu và hỗ trợ', description: t('dataSettingsGroupDescription') || 'Dữ liệu cá nhân, trợ giúp và phản hồi', Icon: Database },
    ];

    return (
        <nav aria-label={t('settingsNavigation') || 'Điều hướng cài đặt'} className="grid min-w-0 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
            {items.map(({ id, label, description, Icon }) => (
                <button
                    key={id}
                    type="button"
                    aria-current={activeCategory === id ? 'page' : undefined}
                    className={`group flex min-h-[64px] min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${activeCategory === id ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-100' : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800'}`}
                    onClick={() => onChange(id)}
                >
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${activeCategory === id ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300' : 'bg-slate-100 text-slate-500 group-hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                        <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold">{label}</span>
                        <span className="mt-1 block text-xs leading-4 text-slate-500 dark:text-slate-400">{description}</span>
                    </span>
                    {id === 'security' && activeSessions > 0 && (
                        <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{activeSessions}</span>
                    )}
                </button>
            ))}
        </nav>
    );
}

export default SettingsMenu;
