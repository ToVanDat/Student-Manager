import { BookOpen, CalendarDays, ChevronRight, Sparkles, User, Users } from 'lucide-react';

function StudentStats({ user, statistics, filteredCount }) {
    return (
        <>
            <div className="mb-6 grid grid-cols-1 items-center gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="text-[27px]">👋</span>
                        <h1 className="m-0 font-display text-[27px] font-bold text-ink dark:text-white">Xin chào, {user?.username || 'bạn'}!</h1>
                    </div>
                    <p className="mt-1.5 mb-3 text-[13px] text-muted">Chúc bạn có một ngày làm việc hiệu quả.</p>
                    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        <CalendarDays size={15} className="text-brand-600" />
                        {new Date().toLocaleDateString('vi-VN', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}
                    </div>
                </div>
                <div className="group relative min-h-[125px] overflow-hidden rounded-xl bg-linear-to-br from-[#183b62] via-[#28647a] to-[#348178] text-white shadow-panel">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.065)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.065)_1px,transparent_1px)] [background-size:30px_30px] opacity-40 transition-transform duration-700 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-linear-to-r from-[#123b66]/60 via-transparent to-[#174068]/10" />
                    <div className="relative z-10 max-w-[300px] p-5 sm:p-6">
                        <span className="block text-sm leading-[1.45] font-bold">“Tri thức là chìa khóa mở ra tương lai.”</span>
                        <button className="mt-3 inline-flex items-center gap-1 rounded-md border-0 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25">Xem thêm<ChevronRight size={15} /></button>
                    </div>
                </div>
            </div>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="group flex min-h-[130px] items-start gap-3.5 rounded-xl border border-line bg-white p-[18px] shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-brand-100 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e9f1ff] text-[#4077ee] transition-transform group-hover:scale-105"><Users size={22} /></div>
                    <div className="min-w-0"><span className="block text-[11px] text-[#7e8ba0]">Tổng số sinh viên</span><strong className="mt-1.5 block text-[26px] font-bold text-[#17233c] dark:text-white">{statistics.totalStudents}</strong><small className="mt-1 block text-[9px] text-[#9aa5b7]">Sinh viên đang quản lý</small></div>
                </div>
                <div className="group flex min-h-[130px] items-start gap-3.5 rounded-xl border border-line bg-white p-[18px] shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e8faf2] text-[#22b981] transition-transform group-hover:scale-105"><BookOpen size={22} /></div>
                    <div className="min-w-0"><span className="block text-[11px] text-[#7e8ba0]">Lớp học</span><strong className="mt-1.5 block text-[26px] font-bold text-[#17233c] dark:text-white">{statistics.totalClasses}</strong><small className="mt-1 block text-[9px] text-[#9aa5b7]">Lớp đang có sinh viên</small></div>
                </div>
                <div className="group flex min-h-[130px] items-start gap-3.5 rounded-xl border border-line bg-white p-[18px] shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-violet-100 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#f1eaff] text-[#8058df] transition-transform group-hover:scale-105"><User size={22} /></div>
                    <div className="min-w-0"><span className="block text-[11px] text-[#7e8ba0]">Phân bố giới tính</span><strong className="mt-1.5 block text-[26px] font-bold text-[#17233c] dark:text-white">{statistics.male}<small className="ml-1 text-[10px] font-medium">Nam</small></strong><small className="mt-1 block text-[9px] text-[#9aa5b7]">{statistics.female} nữ</small></div>
                </div>
                <div className="group flex min-h-[130px] items-start gap-3.5 rounded-xl border border-line bg-white p-[18px] shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-amber-100 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#fff3df] text-[#ee9c20] transition-transform group-hover:scale-105"><Sparkles size={22} /></div>
                    <div className="min-w-0"><span className="block text-[11px] text-[#7e8ba0]">Dữ liệu hệ thống</span><strong className="mt-1.5 block text-[26px] font-bold text-[#17233c] dark:text-white">{filteredCount}</strong><small className="mt-1 block text-[9px] text-[#9aa5b7]">Kết quả đang hiển thị</small></div>
                </div>
            </div>
        </>
    );
}

export default StudentStats;