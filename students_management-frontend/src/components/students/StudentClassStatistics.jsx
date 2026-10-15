import { useLanguage } from '@/context/LanguageContext.jsx';

function StudentClassStatistics({ classStatistics }) {
    const { t } = useLanguage();
    const maxCount = Math.max(0, ...classStatistics.map((item) => item.count));

    return (
        <div className="rounded-xl border border-line bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="m-0 font-display text-sm font-bold text-ink dark:text-white">{t('studentsByClass')}</h2>
            <span className="text-[10px] text-slate-400">{t('topFiveClasses')}</span>
            </div>
            <div className="grid gap-4">
                {classStatistics.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">{t('noClassData')}</div>
                ) : classStatistics.slice(0, 5).map((item) => (
                    <div key={item.code}>
                        <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium text-slate-600 dark:text-slate-300">{item.code}</span><strong className="text-slate-800 dark:text-slate-100">{item.count}</strong></div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <span className="block h-full rounded-full bg-linear-to-r from-brand-500 to-cyan-500 transition-all duration-500" style={{ width: `${maxCount ? (item.count / maxCount) * 100 : 0}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default StudentClassStatistics;