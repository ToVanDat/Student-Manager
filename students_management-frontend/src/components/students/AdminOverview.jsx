import { useMemo } from 'react';
import { useLanguage } from '@/context/LanguageContext.jsx';
import { ArrowRight, BookOpen, CalendarDays, GraduationCap, Users, UserRound, ChartNoAxesCombined, CirclePlus } from 'lucide-react';

const number = (value, language) => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'vi-VN').format(Number(value) || 0);

export default function AdminOverview({ user, statistics, classStatistics = [], students = [], onOpenStudents }) {
    const { language, t } = useLanguage();
    const today = useMemo(() => new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), [language]);
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
        blue: 'bg-[#edf4fb] text-[#2f5f8f] dark:bg-slate-800 dark:text-blue-300',
        emerald: 'bg-[#edf4fb] text-[#2f5f8f] dark:bg-slate-800 dark:text-blue-300',
        violet: 'bg-[#edf4fb] text-[#2f5f8f] dark:bg-slate-800 dark:text-blue-300',
        rose: 'bg-[#edf4fb] text-[#2f5f8f] dark:bg-slate-800 dark:text-blue-300',
    };

    return (
        <div className="admin-overview mx-auto max-w-[1500px] space-y-6 pb-6">
            <header className="admin-overview__hero flex flex-col justify-between gap-5 rounded-xl border border-slate-900/10 bg-[#173b59] px-5 py-6 text-white sm:flex-row sm:items-end sm:px-7 sm:py-7">
                <div className="min-w-0">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[.12em] text-sky-200">{t('administrator')}</p>
                    <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{t('welcome')}, {user?.username || 'Admin'}!</h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200">{t('overview')}</p>
                </div>
                <div className="inline-flex max-w-full items-center gap-3 self-start rounded-lg border border-white/15 bg-white/5 px-3 py-3 text-xs text-white sm:self-auto">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10"><CalendarDays size={18} /></span>
                    <span className="min-w-0"><span className="block text-[10px] font-medium text-slate-300">{t('current')}</span><span className="mt-0.5 block capitalize">{today}</span></span>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ label, value, detail, icon: Icon, color }) => (
                    <article key={label} className="app-card min-w-0 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className={`flex size-10 items-center justify-center rounded-lg ${cardColors[color]}`}><Icon size={19} /></div>
                        </div>
                        <p className="mt-4 text-xs font-medium text-[#71829b] dark:text-slate-400">{label}</p>
                        <p className="mt-1.5 text-[30px] font-bold leading-9 tracking-[-.04em] text-slate-900 dark:text-white sm:text-[32px]">{value}</p>
                        <p className="mt-2 text-[11px] text-[#8190a7] dark:text-slate-400">{detail}</p>
                    </article>
                ))}
            </div>

            <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
                <section className="app-card min-w-0 p-5 sm:p-6">
                    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-blue-600 dark:text-blue-300">{t('classCounts')}</p>
                            <h2 className="text-base font-bold tracking-tight text-[#203754] dark:text-slate-100">{t('classDistribution')}</h2>
                            <p className="mt-1.5 text-xs leading-5 text-[#8190a7] dark:text-slate-400">{t('studentsCount')} · {number(classStatistics.reduce((sum, item) => sum + (Number(item.count) || 0), 0), language)}</p>
                        </div>
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><ChartNoAxesCombined size={19} /></span>
                    </div>
                    {classStatistics.length ? (
                        <div className="space-y-5">
                            {[...classStatistics].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0)).slice(0, 6).map((item, index) => {
                                const count = Number(item.count) || 0;
                                const percent = Number(statistics.totalStudents) > 0 ? Math.round((count / Number(statistics.totalStudents)) * 100) : 0;
                                return <div key={item.code || item.name || index}>
                                    <div className="mb-2 flex items-end justify-between gap-3">
                                        <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.name || item.code || t('className')}</p><p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{item.code || ''}</p></div>
                                        <div className="shrink-0 text-right"><p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{number(count, language)}</p><p className="text-[10px] text-slate-500 dark:text-slate-400">{percent}%</p></div>
                                    </div>
                                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-[#4d78a8] transition-[width] duration-500" style={{ width: `${Math.min(100, (count / maxClassSize) * 100)}%` }} /></div>
                                </div>;
                            })}
                        </div>
                    ) : <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center dark:border-slate-700 dark:bg-slate-950/30"><span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm dark:bg-slate-800"><BookOpen size={24} /></span><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('noClassData')}</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">{t('addClassHint')}</p></div>}
                </section>

                <section className="app-card min-w-0 p-5 sm:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-[#203754] dark:text-slate-100">{t('recentStudents')}</h2><p className="mt-1 text-xs text-[#8190a7] dark:text-slate-400">{t('newestProfiles')}</p></div><button type="button" onClick={onOpenStudents} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">{t('viewAll')} <ArrowRight size={14} /></button></div>
                    {recentStudents.length ? <div className="divide-y divide-[#e8eef7] dark:divide-slate-700">
                        {recentStudents.map(student => <div key={student.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">{String(student.name || 'S').trim().charAt(0).toUpperCase()}</div>
                            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#293b55] dark:text-slate-200">{student.name || t('noData')}</p><p className="mt-0.5 truncate text-[10px] text-[#8190a7] dark:text-slate-400">{student.student_code || student.email || t('studentCode')} · {student.class_code || t('className')}</p></div>
                        </div>)}
                    </div> : <div className="flex min-h-44 flex-col items-center justify-center text-center"><Users className="mb-2 text-slate-300" size={28} /><p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('noStudentProfiles')}</p><p className="mt-1 text-xs text-[#8190a7] dark:text-slate-400">{t('createFirstProfile')}</p></div>}
                    <button type="button" onClick={onOpenStudents} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#174a7e] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#123b66] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"><CirclePlus size={16} />{t('manageStudents')}</button>
                </section>
            </div>


        </div>
    );
}
