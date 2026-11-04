import { CalendarDays } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

function StudentStats({ user, statistics, filteredCount }) {
    const { t, language } = useLanguage();
    const metrics = [
        { label: t('totalStudents'), value: statistics.totalStudents },
        { label: t('classes'), value: statistics.totalClasses },
        { label: t('genderDistribution'), value: `${statistics.male} ${t('male')} · ${statistics.female} ${t('female')}` },
        { label: t('currentlyDisplayedResults'), value: filteredCount },
    ];

    return (
        <>
            <div className="mb-6 grid grid-cols-1 items-center gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <div>
                    <h1 className="m-0 font-display text-[27px] font-bold text-ink dark:text-white">{t('hello')}, {user?.full_name || user?.username || t('user')}!</h1>
                    <p className="mt-1.5 mb-3 text-[13px] text-muted">{t('dailyGreeting')}</p>
                    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <CalendarDays size={15} className="text-brand-600" />
                        {new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'vi-VN', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}
                    </div>
                </div>
                <aside className="flex min-h-[125px] items-center rounded-xl bg-[#183b62] px-5 py-5 text-white sm:px-6">
                    <div className="max-w-[65ch]">
                        <p className="text-sm leading-6 font-semibold">{t('studentQuote')}</p>
                        <p className="mt-2 mb-0 text-sm text-slate-200">{t('studentOverviewCard')}</p>
                    </div>
                </aside>
            </div>

            <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 sm:grid-cols-4 sm:divide-x sm:divide-line">
                {metrics.map(({ label, value }) => (
                    <div key={label} className="min-w-0 sm:px-5 first:sm:pl-0 last:sm:pr-0">
                        <dt className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</dt>
                        <dd className="mt-1.5 text-2xl font-semibold leading-8 tracking-tight tabular-nums text-ink dark:text-white">{value}</dd>
                    </div>
                ))}
            </dl>
        </>
    );
}

export default StudentStats;
