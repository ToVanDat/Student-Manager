import { RefreshCw } from 'lucide-react';
import SettingsMenu from '@/components/settings/SettingsMenu.jsx';

function SettingsPage({ activeTab, onTabChange, activeSessions, loading, onRefresh, children }) {
    return (
        <div className="w-full">
            <div className="mb-6 flex items-center justify-between gap-5 max-[640px]:items-start max-[640px]:flex-col">
                <div>
                    <span className="text-[10px] font-bold tracking-[.14em] text-brand-700">ACCOUNT &amp; SECURITY</span>
                    <h1 className="mt-1.5 mb-1.5 font-display text-[26px] leading-tight font-bold text-ink dark:text-white">Cài đặt tài khoản</h1>
                    <p className="m-0 text-[13px] text-slate-500 dark:text-slate-400">Quản lý thông tin tài khoản, bảo mật và các phiên đăng nhập.</p>
                </div>
                {activeTab === 'sessions' && (
                    <button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:border-brand-100 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" onClick={onRefresh} disabled={loading}>
                        <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />Làm mới
                    </button>
                )}
            </div>
            <div className="grid grid-cols-[225px_minmax(0,1fr)] items-start gap-5 max-[900px]:grid-cols-1">
                <SettingsMenu activeTab={activeTab} onChange={onTabChange} activeSessions={activeSessions} />
                {children}
            </div>
        </div>
    );
}

export default SettingsPage;