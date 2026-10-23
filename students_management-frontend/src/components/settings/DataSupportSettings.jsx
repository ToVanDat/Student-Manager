import { Database, LifeBuoy, MessageSquareWarning } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function DataSupportSettings() {
    const { t } = useLanguage();
    const title = t('dataAndSupport');
    return (
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title === 'dataAndSupport' ? 'Dữ liệu và hỗ trợ' : title}</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">Khu vực này ghi rõ trạng thái chức năng để tránh tạo nút giả hoặc thao tác có thể làm mất dữ liệu.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Database size={19} aria-hidden="true" /></span>
                    <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Xuất hoặc xóa dữ liệu</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Chưa thấy luồng frontend hoàn chỉnh trong nhóm Settings hiện tại. Chưa có nút thao tác cho đến khi quy trình và xác nhận bảo mật được triển khai.</p>
                    <span className="mt-3 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Chưa hoàn chỉnh</span>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><LifeBuoy size={19} aria-hidden="true" /></span>
                    <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Trợ giúp</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Có thể bổ sung trung tâm trợ giúp sau khi xác định nguồn tài liệu và kênh hỗ trợ chính thức của ứng dụng.</p>
                    <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Cần triển khai</span>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:col-span-2">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><MessageSquareWarning size={19} aria-hidden="true" /></span>
                    <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Báo lỗi và phiên bản</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Chưa có luồng báo lỗi/hiển thị phiên bản được xác nhận trong trang Settings này.</p>
                </div>
            </div>
        </section>
    );
}
