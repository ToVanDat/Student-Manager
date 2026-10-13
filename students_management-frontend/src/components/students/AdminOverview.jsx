import { useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, GraduationCap, Users, UserRound, ChartNoAxesCombined, CirclePlus, Activity, ShieldCheck } from 'lucide-react';

const number = value => new Intl.NumberFormat('vi-VN').format(Number(value) || 0);

export default function AdminOverview({ user, statistics, classStatistics = [], students = [], onOpenStudents }) {
    const [today] = useState(() => new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    const recentStudents = [...students]
        .sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0))
        .slice(0, 5);
    const maxClassSize = Math.max(1, ...classStatistics.map(item => Number(item.count) || 0));
    const cards = [
        { label: 'Tổng số sinh viên', value: number(statistics.totalStudents), detail: 'Sinh viên trong hệ thống', icon: Users, color: 'blue' },
        { label: 'Tổng số lớp', value: number(statistics.totalClasses), detail: 'Lớp đang có sinh viên', icon: CalendarDays, color: 'emerald' },
        { label: 'Nam', value: number(statistics.male), detail: 'Theo hồ sơ sinh viên', icon: UserRound, color: 'violet' },
        { label: 'Nữ', value: number(statistics.female), detail: 'Theo hồ sơ sinh viên', icon: GraduationCap, color: 'rose' },
    ];
    const cardColors = {
        blue: 'bg-[#edf5ff] text-[#3478e5]',
        emerald: 'bg-[#e9fbf4] text-[#059669]',
        violet: 'bg-[#f3efff] text-[#7c3aed]',
        rose: 'bg-[#fff0f3] text-[#e11d48]',
    };

    return (
        <div className="admin-overview mx-auto max-w-[1500px] space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-blue-600">Bảng điều khiển quản trị</p>
                    <h1 className="text-2xl font-bold tracking-tight text-[#203754] sm:text-[28px]">Chào mừng, {user?.username || 'Admin'}!</h1>
                    <p className="mt-1 text-sm text-[#71829b]">Tổng quan hệ thống quản lý sinh viên</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-[#e3eaf4] bg-white px-3 py-2 text-xs text-[#71829b] shadow-sm">
                    <CalendarDays size={15} className="text-blue-600" />
                    <span className="capitalize">{today}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ label, value, detail, icon: Icon, color }) => (
                    <article key={label} className="admin-kpi-card rounded-xl border border-[#e3eaf4] bg-white p-4 shadow-[0_5px_18px_rgba(15,40,80,0.045)] transition-colors hover:border-[#bfd8ff] sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className={`flex size-10 items-center justify-center rounded-xl ${cardColors[color]}`}><Icon size={20} /></div>
                            <span className="rounded-full bg-[#f5f8ff] px-2 py-1 text-[10px] font-medium text-[#8190a7]">Hiện tại</span>
                        </div>
                        <p className="mt-4 text-xs font-medium text-[#71829b]">{label}</p>
                        <p className="mt-1 text-[27px] font-bold leading-none tracking-tight text-[#203754]">{value}</p>
                        <p className="mt-2 text-[11px] text-[#8190a7]">{detail}</p>
                    </article>
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
                <section className="rounded-xl border border-[#e3eaf4] bg-white p-4 shadow-[0_5px_18px_rgba(15,40,80,0.045)]">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div><h2 className="text-sm font-bold text-[#203754]">Phân bố sinh viên theo lớp</h2><p className="mt-1 text-xs text-[#8190a7]">Sĩ số theo dữ liệu hiện có</p></div>
                        <span className="flex size-9 items-center justify-center rounded-xl bg-[#edf5ff] text-[#3478e5]"><ChartNoAxesCombined size={18} /></span>
                    </div>
                    {classStatistics.length ? (
                        <div className="space-y-4">
                            {classStatistics.slice(0, 6).map((item, index) => (
                                <div key={item.code}>
                                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{item.name || item.code}</span><span className="shrink-0 text-[#71829b]">{number(item.count)} sinh viên</span></div>
                                    <div className="h-2 overflow-hidden rounded-full bg-[#edf3fb]"><div className={`h-full rounded-full ${['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-cyan-500', 'bg-rose-500'][index]}`} style={{ width: `${Math.max(4, (item.count / maxClassSize) * 100)}%` }} /></div>
                                </div>
                            ))}
                        </div>
                    ) : <div className="flex min-h-44 flex-col items-center justify-center text-center"><BookOpen className="mb-2 text-slate-300" size={28} /><p className="text-sm font-medium text-slate-600">Chưa có dữ liệu lớp</p><p className="mt-1 text-xs text-[#8190a7]">Thêm hồ sơ sinh viên có lớp để xem thống kê.</p></div>}
                </section>

                <section className="rounded-xl border border-[#e3eaf4] bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-[#203754]">Sinh viên gần đây</h2><p className="mt-1 text-xs text-[#8190a7]">Hồ sơ mới nhất trong danh sách</p></div><button type="button" onClick={onOpenStudents} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">Xem tất cả <ArrowRight size={14} /></button></div>
                    {recentStudents.length ? <div className="divide-y divide-[#e8eef7]">
                        {recentStudents.map(student => <div key={student.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{String(student.name || 'S').trim().charAt(0).toUpperCase()}</div>
                            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#293b55]">{student.name || 'Chưa có tên'}</p><p className="mt-0.5 truncate text-[10px] text-[#8190a7]">{student.student_code || student.email || 'Chưa có mã sinh viên'} · {student.class_code || 'Chưa xếp lớp'}</p></div>
                        </div>)}
                    </div> : <div className="flex min-h-44 flex-col items-center justify-center text-center"><Users className="mb-2 text-slate-300" size={28} /><p className="text-sm font-medium text-slate-600">Chưa có hồ sơ sinh viên</p><p className="mt-1 text-xs text-[#8190a7]">Tạo hồ sơ đầu tiên để bắt đầu quản lý.</p></div>}
                    <button type="button" onClick={onOpenStudents} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700"><CirclePlus size={16} />Quản lý sinh viên</button>
                </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <section className="rounded-xl border border-[#e3eaf4] bg-white p-4 shadow-[0_5px_18px_rgba(15,40,80,0.045)]">
                    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-[#203754]">Cơ cấu sinh viên theo lớp</h2><p className="mt-1 text-xs text-[#8190a7]">Tỷ lệ dựa trên dữ liệu lớp hiện có</p></div><Activity size={18} className="text-blue-600" /></div>
                    {classStatistics.length ? <div className="space-y-3">{classStatistics.slice(0, 6).map((item, index) => <div key={item.code}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate text-slate-600">{item.name || item.code}</span><span className="shrink-0 font-semibold text-slate-700">{number(item.count)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf3fb]"><div className={`h-full rounded-full ${['bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-cyan-500','bg-rose-500'][index]}`} style={{ width: `${Math.max(2, (Number(item.count || 0) / maxClassSize) * 100)}%` }} /></div></div>)}</div> : <p className="py-8 text-center text-xs text-[#8190a7]">Chưa có dữ liệu để tổng hợp.</p>}
                </section>
                <section className="rounded-xl border border-[#e3eaf4] bg-white p-4 shadow-[0_5px_18px_rgba(15,40,80,0.045)]">
                    <div className="mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-blue-600" /><div><h2 className="text-sm font-bold text-[#203754]">Tình trạng dữ liệu</h2><p className="mt-1 text-xs text-[#8190a7]">Tổng hợp từ dữ liệu đang tải</p></div></div>
                    <div className="space-y-3"><div className="flex items-center justify-between rounded-lg bg-[#f5f8ff] px-3 py-3"><span className="text-xs text-slate-600">Hồ sơ sinh viên</span><strong className="text-sm text-[#203754]">{number(statistics.totalStudents)}</strong></div><div className="flex items-center justify-between rounded-lg bg-[#f5f8ff] px-3 py-3"><span className="text-xs text-slate-600">Lớp trong hệ thống</span><strong className="text-sm text-[#203754]">{number(statistics.totalClasses)}</strong></div><p className="text-[11px] leading-5 text-[#8190a7]">Biểu đồ theo học kỳ và nhật ký hoạt động cần nguồn dữ liệu lịch sử riêng; dashboard không tự tạo số liệu minh họa.</p></div>
                </section>
            </div>

            <section className="flex flex-col gap-4 rounded-xl bg-gradient-to-r from-[#1768e8] via-[#2889f2] to-[#38b4de] p-5 text-white shadow-lg shadow-blue-600/15 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-100">Student Manager</p><h2 className="mt-1 text-lg font-bold">Quản lý dữ liệu đào tạo tập trung</h2><p className="mt-1 text-xs text-blue-50/90">Theo dõi danh sách sinh viên và sĩ số lớp từ cùng một trang.</p></div>
                <button type="button" onClick={onOpenStudents} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-50">Mở danh sách <ArrowRight size={15} /></button>
            </section>
        </div>
    );
}
