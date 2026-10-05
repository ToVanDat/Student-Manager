import { ClipboardList, Pencil, Plus, Users } from 'lucide-react';

function StudentActivity() {
    return (
        <div className="rounded-xl border border-line bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 font-display text-sm font-bold text-ink dark:text-white">Hoạt động gần đây</h2>
                <button className="rounded px-1 py-1 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800">Xem tất cả</button>
            </div>
            <div className="grid divide-y divide-slate-100 dark:divide-slate-800">
                <div className="flex items-center gap-3 rounded-md py-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Plus size={17} /></div>
                    <div className="min-w-0 flex-1"><strong className="block text-xs text-slate-700 dark:text-slate-200">Thêm mới sinh viên</strong><span className="text-[11px] text-slate-400">Hệ thống quản lý</span></div>
                    <small className="text-[10px] text-slate-400">Vừa xong</small>
                </div>
                <div className="flex items-center gap-3 rounded-md py-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Pencil size={16} /></div>
                    <div className="min-w-0 flex-1"><strong className="block text-xs text-slate-700 dark:text-slate-200">Cập nhật thông tin</strong><span className="text-[11px] text-slate-400">Dữ liệu sinh viên</span></div>
                    <small className="text-[10px] text-slate-400">Gần đây</small>
                </div>
                <div className="flex items-center gap-3 rounded-md py-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><ClipboardList size={16} /></div>
                    <div className="min-w-0 flex-1"><strong className="block text-xs text-slate-700 dark:text-slate-200">Quản lý đăng ký học</strong><span className="text-[11px] text-slate-400">Theo dõi học tập</span></div>
                    <small className="text-[10px] text-slate-400">Hôm nay</small>
                </div>
                <div className="flex items-center gap-3 rounded-md py-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><Users size={16} /></div>
                    <div className="min-w-0 flex-1"><strong className="block text-xs text-slate-700 dark:text-slate-200">Quản lý sinh viên</strong><span className="text-[11px] text-slate-400">Danh sách hiện tại</span></div>
                    <small className="text-[10px] text-slate-400">Hôm nay</small>
                </div>
            </div>
        </div>
    );
}

export default StudentActivity;