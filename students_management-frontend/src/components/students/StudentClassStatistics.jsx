import { ChartNoAxesCombined, GraduationCap, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

const formatNumber = (value, language) =>
    new Intl.NumberFormat(language === 'en' ? 'en-US' : 'vi-VN').format(Number(value) || 0);

const barColors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-cyan-500',
];

function StudentClassStatistics({ classStatistics = [] }) {
    const { t, language } = useLanguage();
    const sortedClasses = [...classStatistics]
        .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
        .slice(0, 5);
    const totalStudents = classStatistics.reduce(
        (sum, item) => sum + (Number(item.count) || 0),
        0,
    );
    const maxCount = Math.max(1, ...sortedClasses.map((item) => Number(item.count) || 0));

    return (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[.15em] text-blue-600 dark:text-blue-300">
                        {t('topFiveClasses')}
                    </p>
                    <h2 className="m-0 text-base font-bold tracking-tight text-slate-900 dark:text-white">
                        {t('studentsByClass')}
                    </h2>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {t('classCounts')}
                    </p>
                </div>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-900">
                    <ChartNoAxesCombined size={19} />
                </span>
            </div>

            {sortedClasses.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center dark:border-slate-700 dark:bg-slate-950/30">
                    <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm dark:bg-slate-800">
                        <GraduationCap size={23} />
                    </span>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('noClassData')}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('addClassHint')}</p>
                </div>
            ) : (
                <>
                    <div className="mb-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/70">
                            <span className="mb-2 flex size-8 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300"><Users size={16} /></span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('totalStudents')}</p>
                            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">{formatNumber(totalStudents, language)}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/70">
                            <span className="mb-2 flex size-8 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm dark:bg-slate-700 dark:text-emerald-300"><GraduationCap size={16} /></span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('totalClasses')}</p>
                            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">{formatNumber(classStatistics.length, language)}</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {sortedClasses.map((item, index) => {
                            const count = Number(item.count) || 0;
                            const percent = totalStudents ? Math.round((count / totalStudents) * 100) : 0;
                            return (
                                <div key={item.code || item.name || index}>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${barColors[index]}`}>
                                                {String(index + 1).padStart(2, '0')}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{item.name || item.code || t('className')}</p>
                                                {item.name && item.code && <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">{item.code}</p>}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatNumber(count, language)}</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">{percent}%</p>
                                        </div>
                                    </div>
                                    <div
                                        className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                                        role="progressbar"
                                        aria-label={`${item.name || item.code || t('className')}: ${percent}%`}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={percent}
                                    >
                                        <div className={`h-full rounded-full transition-[width] duration-500 ${barColors[index]}`} style={{ width: `${Math.min(100, (count / maxCount) * 100)}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </section>
    );
}

export default StudentClassStatistics;
