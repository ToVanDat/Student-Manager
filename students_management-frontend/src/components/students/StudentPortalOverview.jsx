import { useState } from 'react';
import {
    ArrowRight,
    Bell,
    BookOpen,
    CalendarDays,
    ClipboardList,
    FileText,
    GraduationCap,
    MessageSquare,
    Settings2,
    UserRound,
    Video,
} from 'lucide-react';

function EmptyState({ icon: Icon, title, detail }) {
    return (
        <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 py-6 text-center dark:border-slate-700">
            <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <Icon size={19} aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
    );
}

function QuickAction({ icon: Icon, title, detail, onClick, tone = 'blue' }) {
    const tones = {
        blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
        violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
        emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
                <Icon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</strong>
                <small className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{detail}</small>
            </span>
            <ArrowRight size={15} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
        </button>
    );
}

export default function StudentPortalOverview({ user, onOpenChat, onOpenSettings, onOpenCalls }) {
    const displayName = user?.full_name || user?.name || user?.username || 'Sinh viên';
    const [date] = useState(() => new Date().toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }));

    return (
        <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[.14em] text-blue-700 dark:text-blue-300">
                        Cổng thông tin sinh viên
                    </p>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                        Xin chào, {displayName}
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Tổng quan tài khoản và các tiện ích học tập.
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs capitalize text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <CalendarDays size={15} className="text-blue-600 dark:text-blue-300" aria-hidden="true" />
                    {date}
                </div>
            </header>

            <section className="app-panel overflow-hidden">
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex min-w-0 items-start gap-4">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            <GraduationCap size={25} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">Thông tin tài khoản</h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {user?.student_code
                                    ? `Mã sinh viên: ${user.student_code}`
                                    : 'Tài khoản chưa có mã sinh viên được liên kết.'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <UserRound size={16} aria-hidden="true" />
                        Cài đặt hồ sơ
                    </button>
                </div>
            </section>

            <section className="space-y-3">
                <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Thông tin học tập</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Các mục dưới đây chỉ hiển thị dữ liệu sau khi được kết nối với nguồn dữ liệu đào tạo.
                    </p>
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                    <section className="app-panel p-4 sm:p-5">
                        <div className="mb-4 flex items-center gap-2">
                            <CalendarDays size={18} className="text-blue-600 dark:text-blue-300" aria-hidden="true" />
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lịch học</h3>
                        </div>
                        <EmptyState icon={CalendarDays} title="Chưa có dữ liệu lịch học" detail="Thời khóa biểu sẽ xuất hiện tại đây khi có dữ liệu lịch học của tài khoản." />
                    </section>
                    <section className="app-panel p-4 sm:p-5">
                        <div className="mb-4 flex items-center gap-2">
                            <BookOpen size={18} className="text-blue-600 dark:text-blue-300" aria-hidden="true" />
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Môn học</h3>
                        </div>
                        <EmptyState icon={ClipboardList} title="Chưa có dữ liệu đăng ký" detail="Danh sách môn học sẽ hiển thị khi tài khoản có thông tin đăng ký học phần." />
                    </section>
                    <section className="app-panel p-4 sm:p-5">
                        <div className="mb-4 flex items-center gap-2">
                            <FileText size={18} className="text-blue-600 dark:text-blue-300" aria-hidden="true" />
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Kết quả học tập</h3>
                        </div>
                        <EmptyState icon={FileText} title="Chưa có dữ liệu kết quả" detail="Điểm số và kết quả theo học kỳ sẽ hiển thị khi có dữ liệu thực." />
                    </section>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.72fr)]">
                <div className="app-panel p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <Bell size={18} className="text-blue-600 dark:text-blue-300" aria-hidden="true" />
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Thông báo</h2>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Cập nhật dành cho tài khoản của bạn</p>
                        </div>
                    </div>
                    <EmptyState icon={Bell} title="Chưa có thông báo để hiển thị" detail="Thông báo mới sẽ được hiển thị tại khu vực này khi có dữ liệu từ hệ thống." />
                </div>

                <div className="app-panel p-4 sm:p-5">
                    <div className="mb-4">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Truy cập nhanh</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Các chức năng hiện có</p>
                    </div>
                    <div className="grid gap-2">
                        <QuickAction icon={MessageSquare} title="Tin nhắn" detail="Trò chuyện và gửi tệp" onClick={onOpenChat} />
                        <QuickAction icon={Video} title="Cuộc gọi" detail="Mở không gian cuộc gọi" onClick={onOpenCalls} tone="violet" />
                        <QuickAction icon={Settings2} title="Cài đặt tài khoản" detail="Hồ sơ và bảo mật" onClick={onOpenSettings} tone="emerald" />
                    </div>
                </div>
            </section>
        </div>
    );
}
