import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext.jsx';
import { ArrowRight, BookOpen, CalendarDays, GraduationCap, Users, UserRound, ChartNoAxesCombined, CirclePlus } from 'lucide-react';

const number = (value, language) => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'vi-VN').format(Number(value) || 0);

export default function AdminOverview({ user, statistics, classStatistics = [], students = [], onOpenStudents }) {
    const { language, t } = useLanguage();
    const [today] = useState(() => new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    const recentStudents = [...students]
        .sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0))
        .slice(0, 5);
    const maxClassSize = Math.max(1, ...classStatistics.map(item => Number(item.count) || 0));
    const cards = [
        { label: t('totalStudents'), value: number(statistics.totalStudents, language), detail: t('studentsInSystem'), icon: Users, color: 'blue' },
        { label: t('totalClasses'), value: number(statistics.totalClasses, language), detail: t('classesWithStudents'), icon: CalendarDays, color: 'emerald' },
        { label: t('male'), value: number(statistics.male, language), detail: t('studentProfile'), icon: UserRound, color: 'violet' },
        { label: t('female'), value: number(statistics.female, language), detail: t('studentProfile'), icon: GraduationCap, color: 'rose' },
    ];
    const cardColors = {
        blue: 'bg-[#edf5ff] text-[#3478e5] dark:bg-blue-950/60 dark:text-blue-300',
        emerald: 'bg-[#e9fbf4] text-[#059669] dark:bg-emerald-950/50 dark:text-emerald-300',
        violet: 'bg-[#f3efff] text-[#7c3aed] dark:bg-violet-950/50 dark:text-violet-300',
        rose: 'bg-[#fff0f3] text-[#e11d48] dark:bg-rose-950/50 dark:text-rose-300',
    };

    return (
        <div className="admin-overview mx-auto max-w-[1500px] space-y-6 pb-6">
            <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#102d4d] via-[#17466c] to-[#216f91] px-5 py-6 text-white shadow-xl shadow-blue-950/10 sm:px-8 sm:py-8"><div className="absolute -right-10 -top-16 -z-10 size-64 rounded-full border-[28px] border-white/5" /><div className="absolute right-24 -bottom-28 -z-10 size-64 rounded-full border border-white/10" /><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-sky-100"><GraduationCap size={14} />{t('administrator')}</div>
                    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t('welcome')}, {user?.username || 'Admin'}!</h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/85">{t('overview')}</p>
                </div>
                <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white backdrop-blur-sm">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-white/10"><CalendarDays size={19} /></span><span className="hidden text-[10px] font-semibold uppercase tracking-wider text-blue-100/70 sm:block">{t('current')}</span>
                    <span className="capitalize">{today}</span>
                </div>
            </div></header>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ label, value, detail, icon: Icon, color }) => (
                    <article key={label} className="app-card relative overflow-hidden p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className={`flex size-10 items-center justify-center rounded-xl ${cardColors[color]}`}><Icon size={20} /></div>
                            <span className="mt-1 size-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-950/60" aria-hidden="true" />
                        </div>
                        <p className="mt-4 text-xs font-medium text-[#71829b] dark:text-slate-400">{label}</p>
                        <p className="mt-1.5 text-[30px] font-bold leading-9 tracking-[-.04em] text-slate-900 dark:text-white sm:text-[32px]">{value}</p>
                        <p className="mt-2 text-[11px] text-[#8190a7] dark:text-slate-400">{detail}</p>
                    </article>
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
                <section className="app-card p-4 sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div><h2 className="text-sm font-bold text-[#203754] dark:text-slate-100">{t('classDistribution')}</h2><p className="mt-1 text-xs text-[#8190a7] dark:text-slate-400">{t('classCounts')}</p></div>
                        <span className="flex size-9 items-center justify-center rounded-xl bg-[#edf5ff] text-[#3478e5] dark:bg-blue-950/60 dark:text-blue-300"><ChartNoAxesCombined size={18} /></span>
                    </div>
                    {classStatistics.length ? (
                        <div className="space-y-4">
                            {classStatistics.slice(0, 6).map((item, index) => (
                                <div key={item.code}>
                                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700 dark:text-slate-200">{item.name || item.code}</span><span className="shrink-0 text-[#71829b] dark:text-slate-400">{number(item.count, language)} {t('studentsCount')}</span></div>
                                    <div className="h-2 overflow-hidden rounded-full bg-[#edf3fb] dark:bg-slate-800"><div className={`h-full rounded-full ${['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-cyan-500', 'bg-rose-500'][index]}`} style={{ width: `${Math.max(4, (item.count / maxClassSize) * 100)}%` }} /></div>
                                </div>
                            ))}
                        </div>
                    ) : <div className="flex min-h-44 flex-col items-center justify-center text-center"><BookOpen className="mb-2 text-slate-300" size={28} /><p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('noClassData')}</p><p className="mt-1 text-xs text-[#8190a7] dark:text-slate-400">{t('addClassHint')}</p></div>}
                </section>

                <section className="app-card p-4 sm:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-[#203754] dark:text-slate-100">{t('recentStudents')}</h2><p className="mt-1 text-xs text-[#8190a7] dark:text-slate-400">{t('newestProfiles')}</p></div><button type="button" onClick={onOpenStudents} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">{t('viewAll')} <ArrowRight size={14} /></button></div>
                    {recentStudents.length ? <div className="divide-y divide-[#e8eef7] dark:divide-slate-700">
                        {recentStudents.map(student => <div key={student.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">{String(student.name || 'S').trim().charAt(0).toUpperCase()}</div>
                            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#293b55] dark:text-slate-200">{student.name || t('noData')}</p><p className="mt-0.5 truncate text-[10px] text-[#8190a7] dark:text-slate-400">{student.student_code || student.email || t('studentCode')} · {student.class_code || t('className')}</p></div>
                        </div>)}
                    </div> : <div className="flex min-h-44 flex-col items-center justify-center text-center"><Users className="mb-2 text-slate-300" size={28} /><p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('noStudentProfiles')}</p><p className="mt-1 text-xs text-[#8190a7] dark:text-slate-400">{t('createFirstProfile')}</p></div>}
                    <button type="button" onClick={onOpenStudents} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#174a7e] px-4 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#123b66] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"><CirclePlus size={16} />{t('manageStudents')}</button>
                </section>
            </div>


        </div>
    );
}
