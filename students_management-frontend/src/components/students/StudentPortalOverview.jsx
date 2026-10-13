import { useState } from 'react';
import { ArrowRight, Bell, BookOpen, CalendarDays, FileText, GraduationCap, MessageSquare, Settings2, UserRound, Video, Clock3, ClipboardList } from 'lucide-react';

function EmptyRow({ icon: Icon, title, detail }) {
    return <div className="flex min-h-[112px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center dark:border-slate-700"><Icon size={22} className="mb-2 text-slate-300" /><p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{title}</p><p className="mt-1 max-w-xs text-[10px] leading-4 text-slate-400">{detail}</p></div>;
}

export default function StudentPortalOverview({ user, onOpenChat, onOpenSettings, onOpenCalls }) {
    const displayName = user?.full_name || user?.name || user?.username || 'Sinh viên';
    const [date] = useState(() => new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

    return (
        <div className="student-overview mx-auto max-w-[1500px] space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-blue-600">Cổng thông tin sinh viên</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-[28px]">Xin chào, {displayName}!</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Chúc bạn có một ngày học tập hiệu quả.</p></div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs capitalize text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><CalendarDays size={15} className="text-blue-600" />{date}</div>
            </div>

            <section className="student-hero relative isolate overflow-hidden rounded-xl bg-gradient-to-r from-[#0874e8] via-[#168df2] to-[#31b9e8] p-6 text-white shadow-lg shadow-blue-600/15 sm:min-h-[154px] sm:p-8">
                <div className="absolute inset-y-0 right-0 -z-10 w-[48%] bg-cover bg-center opacity-25" style={{ backgroundImage: "linear-gradient(90deg, #168df2, transparent), url('https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80')" }} />
                <div className="absolute -right-10 -top-24 -z-10 size-72 rounded-full border-[38px] border-white/10" /><div className="absolute right-28 -bottom-32 -z-10 size-56 rounded-full bg-cyan-200/15 blur-2xl" />
                <div className="max-w-xl"><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold tracking-wide"><GraduationCap size={14} />KHU VỰC SINH VIÊN</span><h2 className="mt-3 text-xl font-bold sm:text-2xl">Học tập để kiến tạo tương lai</h2><p className="mt-1.5 text-xs leading-5 text-blue-50">Thông tin hồ sơ, lịch học và kết quả sẽ hiển thị tại đây khi được kết nối với dữ liệu đào tạo.</p></div>
            </section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Hồ sơ sinh viên', value: user?.student_code || 'Chưa liên kết', note: user?.student_code ? 'Mã sinh viên' : 'Tài khoản chưa gắn hồ sơ', icon: UserRound, color: 'blue' },
                    { label: 'Lịch học hôm nay', value: '—', note: 'Chưa có dữ liệu lịch học', icon: CalendarDays, color: 'emerald' },
                    { label: 'Môn học đang học', value: '—', note: 'Chưa có dữ liệu đăng ký', icon: BookOpen, color: 'violet' },
                    { label: 'Kết quả học tập', value: '—', note: 'Chưa có dữ liệu điểm', icon: FileText, color: 'amber' },
                ].map(({ label, value, note, icon: Icon, color }) => <article key={label} className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_5px_18px_rgba(15,40,80,0.045)] transition-colors hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900 sm:p-5"><div className="flex items-center justify-between"><span className={`flex size-10 items-center justify-center rounded-xl ${color === 'blue' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300' : color === 'emerald' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300' : color === 'violet' ? 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300'}`}><Icon size={19} /></span><span className="text-[10px] text-slate-300">HỌC TẬP</span></div><p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 truncate text-xl font-bold text-slate-900 dark:text-white">{value}</p><p className="mt-1 text-[10px] text-slate-400">{note}</p></article>)}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <section className="rounded-xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_5px_18px_rgba(15,40,80,0.045)] dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Lịch học hôm nay</h2><p className="mt-1 text-xs text-slate-400">Lịch cá nhân của bạn</p></div><button type="button" onClick={onOpenSettings} className="text-xs font-semibold text-blue-600">Xem lịch <ArrowRight size={13} className="inline" /></button></div>
                    <EmptyRow icon={Clock3} title="Chưa có lịch học" detail="Khi dữ liệu thời khóa biểu được kết nối, các tiết học trong ngày sẽ hiển thị tại đây." />
                </section>
                <section className="rounded-xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_5px_18px_rgba(15,40,80,0.045)] dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Kết quả học tập gần đây</h2><p className="mt-1 text-xs text-slate-400">Điểm số theo học kỳ</p></div><ClipboardList size={18} className="text-blue-600" /></div>
                    <EmptyRow icon={FileText} title="Chưa có kết quả học tập" detail="Bảng điểm sẽ được hiển thị khi tài khoản có dữ liệu môn học và học kỳ." />
                </section>
                <section className="rounded-xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_5px_18px_rgba(15,40,80,0.045)] dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Lịch học hôm nay</h2><p className="mt-1 text-xs text-slate-400">Lịch cá nhân của bạn</p></div><CalendarDays size={18} className="text-blue-600" /></div><EmptyRow icon={CalendarDays} title="Chưa có lịch học" detail="Dữ liệu thời khóa biểu sẽ xuất hiện khi hệ thống được kết nối với module đào tạo." /></section>
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Kết quả học tập gần đây</h2><p className="mt-1 text-xs text-slate-400">Điểm số theo học kỳ</p></div><BookOpen size={18} className="text-blue-600" /></div><EmptyRow icon={FileText} title="Chưa có kết quả học tập" detail="Bảng điểm sẽ được hiển thị ở đây sau khi có dữ liệu môn học và học kỳ." /></section>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Thông báo mới nhất</h2><p className="mt-1 text-xs text-slate-400">Cập nhật dành cho bạn</p></div><Bell size={18} className="text-blue-600" /></div><EmptyRow icon={Bell} title="Chưa có thông báo" detail="Thông báo học tập và thông báo hệ thống sẽ được gom tại đây." /></section>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="mb-4"><h2 className="text-sm font-bold text-slate-900 dark:text-white">Truy cập nhanh</h2><p className="mt-1 text-xs text-slate-400">Các chức năng đang có trong project</p></div><div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={onOpenChat} className="flex items-center gap-3 rounded-xl bg-blue-50 p-3 text-left transition hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50"><MessageSquare size={18} className="text-blue-600" /><span><strong className="block text-xs text-slate-800 dark:text-slate-100">Mở tin nhắn</strong><small className="mt-0.5 block text-[10px] text-slate-400">Chat và gửi tệp</small></span><ArrowRight size={14} className="ml-auto text-slate-400" /></button>
                    <button type="button" onClick={onOpenCalls} className="flex items-center gap-3 rounded-xl bg-violet-50 p-3 text-left transition hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-900/50"><Video size={18} className="text-violet-600" /><span><strong className="block text-xs text-slate-800 dark:text-slate-100">Cuộc gọi</strong><small className="mt-0.5 block text-[10px] text-slate-400">Lịch sử và thông báo</small></span><ArrowRight size={14} className="ml-auto text-slate-400" /></button>
                    <button type="button" onClick={onOpenSettings} className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-left transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50"><Settings2 size={18} className="text-emerald-600" /><span><strong className="block text-xs text-slate-800 dark:text-slate-100">Cài đặt tài khoản</strong><small className="mt-0.5 block text-[10px] text-slate-400">Hồ sơ và bảo mật</small></span><ArrowRight size={14} className="ml-auto text-slate-400" /></button>
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><FileText size={18} className="text-slate-400" /><span><strong className="block text-xs text-slate-600 dark:text-slate-300">Tài liệu học tập</strong><small className="mt-0.5 block text-[10px] text-slate-400">Chưa có module tài liệu</small></span></div>
                </div></section>
            </div>
        </div>
    );
}
