import { useEffect, useMemo, useState } from 'react';
import {
    ArrowRight, Bell, BookOpen, CalendarDays, FileText, GraduationCap,
    MessageSquare, RefreshCw, Settings2, UserRound, Video, AlertCircle,
    CheckCircle2, Clock3,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';
import { getMyStudentPortal } from '@/api/studentApi.js';
import { notificationApi } from '@/api/notificationApi.js';

function EmptyState({ icon: Icon, title, detail }) {
    return <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 py-6 text-center dark:border-slate-700">
        <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><Icon size={19} aria-hidden="true" /></span>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>;
}

function QuickAction({ icon: Icon, title, detail, onClick, tone = 'blue' }) {
    const tones = {
        blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
        violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
        emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    };
    return <button type="button" onClick={onClick} className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={18} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</strong><small className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{detail}</small></span>
        <ArrowRight size={15} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
    </button>;
}

function formatDate(value, language) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function Score({ value }) {
    if (value === null || value === undefined || value === '') return <span className="text-slate-400">—</span>;
    return <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{Number(value).toFixed(2)}</span>;
}

export default function StudentPortalOverview({ user, onOpenChat, onOpenSettings, onOpenCalls }) {
    const { t, language } = useLanguage();
    const [portal, setPortal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [notificationError, setNotificationError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);
    const copy = language === 'en' ? {
        linked: 'Student record linked', notLinked: 'This account is not linked to a student record',
        linkHelp: 'For privacy, accounts are never matched by email alone. Contact an administrator or the academic office to verify and link your record.',
        class: 'Class', department: 'Department', email: 'Student email', gender: 'Gender', dob: 'Date of birth',
        credits: 'credits', total: 'Final score', schedule: 'Timetable data is not available yet',
        scheduleHelp: 'The academic source does not currently provide class sessions, rooms or scheduled times.',
        retry: 'Retry', loadFail: 'Could not load your student portal. Please try again.',
        noticeFail: 'Could not load notifications.', fallback: 'New notification',
    } : {
        linked: 'Đã liên kết hồ sơ', notLinked: 'Tài khoản chưa được liên kết hồ sơ sinh viên',
        linkHelp: 'Để bảo vệ dữ liệu cá nhân, hệ thống không tự ghép tài khoản theo email. Vui lòng liên hệ quản trị viên/Phòng đào tạo để xác minh và liên kết hồ sơ.',
        class: 'Lớp', department: 'Khoa', email: 'Email sinh viên', gender: 'Giới tính', dob: 'Ngày sinh',
        credits: 'tín chỉ', total: 'Điểm tổng kết', schedule: 'Chưa có dữ liệu thời khóa biểu',
        scheduleHelp: 'Nguồn dữ liệu đào tạo hiện chưa cung cấp ca học, phòng học và thời gian học.',
        retry: 'Thử lại', loadFail: 'Không thể tải cổng sinh viên. Vui lòng thử lại.',
        noticeFail: 'Không thể tải thông báo.', fallback: 'Thông báo mới',
    };
    const displayName = portal?.student?.name || user?.full_name || user?.name || user?.username || t('user');
    const date = useMemo(() => new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()), [language]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        getMyStudentPortal()
            .then(data => { if (active) setPortal(data); })
            .catch(requestError => {
                if (!active) return;
                setError(requestError.response?.data?.message || copy.loadFail);
                setPortal(null);
            })
            .finally(() => { if (active) setLoading(false); });
        notificationApi.getHistory(5, 0)
            .then(({ data }) => { if (active) setNotifications(Array.isArray(data?.data) ? data.data : []); })
            .catch(() => { if (active) setNotificationError(copy.noticeFail); });
        return () => { active = false; };
    }, [reloadKey, language]);

    const student = portal?.student;
    const enrollments = Array.isArray(portal?.enrollments) ? portal.enrollments : [];
    const linked = portal?.linked === true;
    const results = enrollments.filter(item => item.total_score !== null && item.total_score !== undefined);

    return <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0"><p className="mb-2 text-xs font-semibold uppercase tracking-[.14em] text-blue-700 dark:text-blue-300">{t('studentPortalEyebrow')}</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{t('studentWelcome', { name: displayName })}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('studentPortalDescription')}</p></div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs capitalize text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><CalendarDays size={15} className="text-blue-600 dark:text-blue-300" aria-hidden="true" />{date}</div>
        </header>

        {error && <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between" role="alert"><span className="flex items-start gap-2"><AlertCircle size={18} className="mt-0.5 shrink-0" />{error}</span><button type="button" onClick={() => setReloadKey(value => value + 1)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-rose-300 px-3 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40"><RefreshCw size={14} />{copy.retry}</button></div>}

        <section className="app-panel overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><GraduationCap size={25} aria-hidden="true" /></span><div className="min-w-0"><h2 className="text-base font-bold text-slate-900 dark:text-white">{t('studentAccountDetails')}</h2>
                    {loading ? <div className="mt-2 h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /> : linked ? <div className="mt-1 space-y-1 text-sm text-slate-500 dark:text-slate-400"><p>{t('studentCodePrefix', { code: student.student_code })}</p><p>{[student.class_code, student.class_name].filter(Boolean).join(' · ') || '—'}</p>{student.department_name && <p>{student.department_name}</p>}</div> : <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('studentCodeMissing')}</p>}
                </div></div>
                <button type="button" onClick={onOpenSettings} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><UserRound size={16} aria-hidden="true" />{t('studentProfileSettings')}</button>
            </div>
            {!loading && !error && !linked && <div className="mx-5 mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200 sm:mx-6"><AlertCircle size={18} className="mt-0.5 shrink-0" /><div><p className="font-semibold">{copy.notLinked}</p><p className="mt-1 leading-6">{copy.linkHelp}</p></div></div>}
            {linked && <div className="grid gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:grid-cols-3 sm:px-6"><div><p className="text-xs text-slate-500">{copy.email}</p><p className="mt-1 break-all text-sm font-medium text-slate-800 dark:text-slate-100">{student.email || '—'}</p></div><div><p className="text-xs text-slate-500">{copy.gender}</p><p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{student.gender || '—'}</p></div><div><p className="text-xs text-slate-500">{copy.dob}</p><p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{formatDate(student.date_of_birth, language)}</p></div></div>}
        </section>

        <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-base font-bold text-slate-900 dark:text-white">{t('studentAcademicInfo')}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('studentAcademicHint')}</p></div>{linked && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><CheckCircle2 size={14} />{copy.linked}</span>}</div>
            <div className="grid gap-4 xl:grid-cols-3">
                <section className="app-panel p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><CalendarDays size={18} className="text-blue-600 dark:text-blue-300" /><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('studentSchedule')}</h3></div><EmptyState icon={Clock3} title={copy.schedule} detail={copy.scheduleHelp} /></section>
                <section className="app-panel p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><BookOpen size={18} className="text-blue-600 dark:text-blue-300" /><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('studentSubjects')}</h3></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{enrollments.length}</span></div>
                    {loading ? <div className="space-y-3">{[1,2,3].map(item => <div key={item} className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}</div> : !linked || !enrollments.length ? <EmptyState icon={BookOpen} title={t('studentSubjectsEmptyTitle')} detail={t('studentSubjectsEmptyDetail')} /> : <ul className="space-y-2">{enrollments.slice(0, 5).map(item => <li key={item.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.subject_name}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.subject_code} · {item.credits} {copy.credits} · {item.semester_name} {item.academic_year}</p></li>)}</ul>}
                </section>
                <section className="app-panel p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><FileText size={18} className="text-blue-600 dark:text-blue-300" /><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('studentResults')}</h3></div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">{results.length}</span></div>
                    {loading ? <div className="space-y-3">{[1,2,3].map(item => <div key={item} className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}</div> : !linked || !results.length ? <EmptyState icon={FileText} title={t('studentResultsEmptyTitle')} detail={t('studentResultsEmptyDetail')} /> : <ul className="space-y-2">{results.slice(0, 5).map(item => <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.subject_name}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.semester_name} {item.academic_year}</p></div><div className="shrink-0 text-right"><p className="text-[10px] text-slate-500">{copy.total}</p><Score value={item.total_score} /></div></li>)}</ul>}
                </section>
            </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.72fr)]">
            <div className="app-panel p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><Bell size={18} className="text-blue-600 dark:text-blue-300" /><div><h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('studentNotifications')}</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('studentNotificationsDescription')}</p></div></div>
                {notificationError ? <p className="text-xs text-rose-600 dark:text-rose-300">{notificationError}</p> : notifications.length === 0 ? <EmptyState icon={Bell} title={t('studentNotificationsEmptyTitle')} detail={t('studentNotificationsEmptyDetail')} /> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{notifications.map((item, index) => <li key={item.id ?? index} className="flex gap-3 py-3 first:pt-0 last:pb-0"><span className={`mt-1 size-2 shrink-0 rounded-full ${item.is_read ? 'bg-slate-300 dark:bg-slate-600' : 'bg-blue-500'}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title || item.message || copy.fallback}</p>{item.body && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.body}</p>}<p className="mt-1 text-[11px] text-slate-400">{formatDate(item.created_at, language)}</p></div></li>)}</ul>}
            </div>
            <div className="app-panel p-4 sm:p-5"><div className="mb-4"><h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('studentQuickAccess')}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('studentQuickAccessDescription')}</p></div><div className="grid gap-2"><QuickAction icon={MessageSquare} title={t('studentMessages')} detail={t('studentMessagesDetail')} onClick={onOpenChat} /><QuickAction icon={Video} title={t('studentCalls')} detail={t('studentCallsDetail')} onClick={onOpenCalls} tone="violet" /><QuickAction icon={Settings2} title={t('studentAccountSettings')} detail={t('studentAccountSettingsDetail')} onClick={onOpenSettings} tone="emerald" /></div></div>
        </section>
    </div>;
}
