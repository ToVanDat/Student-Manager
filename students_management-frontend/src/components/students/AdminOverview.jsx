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
        blue: 'bg-[#edf5ff] text-[#3478e5]',
        emerald: 'bg-[#e9fbf4] text-[#059669]',
        violet: 'bg-[#f3efff] text-[#7c3aed]',
        rose: 'bg-[#fff0f3] text-[#e11d48]',
    };

    return (
        <div className="admin-overview mx-auto max-w-[1500px] space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-blue-600">{t('dashboard')}</p>
                    <h1 className="text-2xl font-bold tracking-tight text-[#203754] dark:text-slate-100 sm:text-[28px]">{t('welcome')}, {user?.username || 'Admin'}!</h1>
                    <p className="mt-1 text-sm text-[#71829b] dark:text-slate-400">{t('overview')}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-[#e3eaf4] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-[#71829b] dark:text-slate-400 shadow-sm">
                    <CalendarDays size={15} className="text-blue-600" />
                    <span className="capitalize">{today}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ label, value, detail, icon: Icon, color }) => (
                    <article key={label} className="admin-kpi-card rounded-xl border border-[#e3eaf4] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_5px_18px_rgba(15,40,80,0.045)] transition-colors hover:border-[#bfd8ff] dark:hover:border-blue-800 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className={`flex size-10 items-center justify-center rounded-xl ${cardColors[color]}`}><Icon size={20} /></div>
                            <span className="rounded-full bg-[#f5f8ff] dark:bg-slate-800 px-2 py-1 text-[10px] font-medium text-[#8190a7] dark:text-slate-400">{t('current')}</span>
                        </div>
                        <p className="mt-4 text-xs font-medium text-[#71829b] dark:text-slate-400">{label}</p>
                        <p className="mt-1 text-[27px] font-bold leading-none tracking-tight text-[#203754] dark:text-slate-100">{value}</p>
                        <p className="mt-2 text-[11px] text-[#8190a7]">{detail}</p>
                    </article>
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
                <section className="rounded-xl border border-[#e3eaf4] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_5px_18px_rgba(15,40,80,0.045)]">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div><h2 className="text-sm font-bold text-[#203754] dark:text-slate-100">{t('classDistribution')}</h2><p className="mt-1 text-xs text-[#8190a7]">{t('classCounts')}</p></div>
                        <span className="flex size-9 items-center justify-center rounded-xl bg-[#edf5ff] text-[#3478e5]"><ChartNoAxesCombined size={18} /></span>
                    </div>
                    {classStatistics.length ? (
                        <div className="space-y-4">
                            {classStatistics.slice(0, 6).map((item, index) => (
                                <div key={item.code}>
                                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{item.name || item.code}</span><span className="shrink-0 text-[#71829b] dark:text-slate-400">{number(item.count, language)} {t('studentsCount')}</span></div>
                                    <div className="h-2 overflow-hidden rounded-full bg-[#edf3fb]"><div className={`h-full rounded-full ${['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-cyan-500', 'bg-rose-500'][index]}`} style={{ width: `${Math.max(4, (item.count / maxClassSize) * 100)}%` }} /></div>
                                </div>
                            ))}
                        </div>
                    ) : <div className="flex min-h-44 flex-col items-center justify-center text-center"><BookOpen className="mb-2 text-slate-300" size={28} /><p className="text-sm font-medium text-slate-600">{t('noClassData')}</p><p className="mt-1 text-xs text-[#8190a7]">{t('addClassHint')}</p></div>}
                </section>

                <section className="rounded-xl border border-[#e3eaf4] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-[#203754] dark:text-slate-100">{t('recentStudents')}</h2><p className="mt-1 text-xs text-[#8190a7]">{t('newestProfiles')}</p></div><button type="button" onClick={onOpenStudents} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">{t('viewAll')} <ArrowRight size={14} /></button></div>
                    {recentStudents.length ? <div className="divide-y divide-[#e8eef7]">
                        {recentStudents.map(student => <div key={student.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{String(student.name || 'S').trim().charAt(0).toUpperCase()}</div>
                            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#293b55]">{student.name || t('noData')}</p><p className="mt-0.5 truncate text-[10px] text-[#8190a7]">{student.student_code || student.email || t('studentCode')} · {student.class_code || t('className')}</p></div>
                        </div>)}
                    </div> : <div className="flex min-h-44 flex-col items-center justify-center text-center"><Users className="mb-2 text-slate-300" size={28} /><p className="text-sm font-medium text-slate-600">{t('noStudentProfiles')}</p><p className="mt-1 text-xs text-[#8190a7]">{t('createFirstProfile')}</p></div>}
                    <button type="button" onClick={onOpenStudents} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700"><CirclePlus size={16} />{t('manageStudents')}</button>
                </section>
            </div>


        </div>
    );
}
