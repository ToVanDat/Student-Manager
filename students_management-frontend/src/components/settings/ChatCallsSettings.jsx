import { ArrowUpRight, BellOff, LockKeyhole, PhoneCall } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';
import CameraSettings from '@/components/settings/CameraSettings.jsx';

export default function ChatCallsSettings({ onOpenChat }) {
    const { t } = useLanguage();
    const items = [
        { Icon: LockKeyhole, title: 'Khóa Chat bằng PIN', detail: 'Cơ chế khóa PIN hiện nằm trong giao diện Chat; không thay thế mật khẩu tài khoản hoặc mã hóa E2EE.' },
        { Icon: BellOff, title: 'Tắt thông báo từng cuộc trò chuyện', detail: 'Tùy chọn thông báo riêng theo cuộc trò chuyện được quản lý từ cuộc trò chuyện tương ứng.' },
        { Icon: PhoneCall, title: 'Cuộc gọi và thiết bị', detail: 'Quyền camera, micro và chia sẻ màn hình được trình duyệt hỏi khi bạn chủ động sử dụng tính năng.' },
    ];
    return (
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('chatAndCalls') === 'chatAndCalls' ? 'Chat và cuộc gọi' : t('chatAndCalls')}</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">Các tùy chọn đã có được giữ tại đúng nơi sử dụng; mục chưa có giao diện quản lý riêng sẽ không hiển thị công tắc giả.</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map(({ Icon, title, detail }) => (
                    <div key={title} className="flex min-w-0 items-start gap-3 py-4 first:pt-0 last:pb-0">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon size={19} aria-hidden="true" /></span>
                        <div className="min-w-0"><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p></div>
                    </div>
                ))}
            </div>
            <button type="button" onClick={onOpenChat} className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                Mở Chat và cuộc gọi <ArrowUpRight size={16} aria-hidden="true" />
            </button>
        </section>
        <CameraSettings />
    );
}
