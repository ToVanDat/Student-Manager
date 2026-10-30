import { BookOpen, CalendarDays, Sparkles, User, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

function StudentStats({ user, statistics, filteredCount }) {
    const { t, language } = useLanguage();
    return (
        <>
            <div className="mb-6 grid grid-cols-1 items-center gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="text-[27px]">👋</span>
                        <h1 className="m-0 font-display text-[27px] font-bold text-ink dark:text-white">{t('hello')}, {user?.full_name || user?.username || t('user')}!</h1>
                    </div>
                    <p className="mt-1.5 mb-3 text-[13px] text-muted">{t('dailyGreeting')}</p>
                    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        <CalendarDays size={15} className="text-brand-600" />
                        {new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'vi-VN', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}
                    </div>
                </div>
                <div className="group relative min-h-[125px] overflow-hidden rounded-xl bg-linear-to-br from-[#183b62] via-[#28647a] to-[#348178] text-white shadow-panel">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.065)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.065)_1px,transparent_1px)] [background-size:30px_30px] opacity-40 transition-transform duration-700 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-linear-to-r from-[#123b66]/60 via-transparent to-[#174068]/10" />
                    <div className="relative z-10 max-w-[300px] p-5 sm:p-6">
                        <span className="block text-sm leading-[1.45] font-bold">{t('studentQuote')}</span>
                        <p className="mt-3 mb-0 text-xs text-cyan-50/90">{t('studentOverviewCard')}</p>
                    </div>
                </div>
            </div>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="group flex min-h-[130px] items-start gap-3.5 rounded-xl border border-line bg-white p-[18px] shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-brand-100 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e9f1ff] text-[#4077ee] transition-transform group-hover:scale-105"><Users size={22} /></div>
                    <div className="min-w-0"><span className="block text-[11px] text-[#7e8ba0]">{t('totalStudents')}</span><strong className="mt-1.5 block text-[26px] font-bold text-[#17233c] dark:text-white">{statistics.totalStudents}</strong><small className="mt-1 block text-[9px] text-[#9aa5b7]">{t('studentsInSystem')}</small></div>
                </div>
                <div className="group flex min-h-[130px] items-start gap-3.5 rounded-xl border border-line bg-white p-[18px] shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e8faf2] text-[#22b981] transition-transform group-hover:scale-105"><BookOpen size={22} /></div>
                    <div className="min-w-0"><span className="block text-[11px] text-[#7e8ba0]">{t('classes')}</span><strong className="mt-1.5 block text-[26px] font-bold text-[#17233c] dark:text-white">{statistics.totalClasses}</strong><small className="mt-1 block text-[9px] text-[#9aa5b7]">{t('classesWithStudents')}</small></div>
                </div>
                <div className="group flex min-h-[130px] items-start gap-3.5 rounded-xl border border-line bg-white p-[18px] shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-violet-100 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#f1eaff] text-[#8058df] transition-transform group-hover:scale-105"><User size={22} /></div>
                    <div className="min-w-0"><span className="block text-[11px] text-[#7e8ba0]">{t('genderDistribution')}</span><strong className="mt-1.5 block text-[26px] font-bold text-[#17233c] dark:text-white">{statistics.male}<small className="ml-1 text-[10px] font-medium">{t('male')}</small></strong><small className="mt-1 block text-[9px] text-[#9aa5b7]">{statistics.female} {t('female').toLowerCase()}</small></div>
                </div>
                <div className="group flex min-h-[130px] items-start gap-3.5 rounded-xl border border-line bg-white p-[18px] shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-amber-100 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#fff3df] text-[#ee9c20] transition-transform group-hover:scale-105"><Sparkles size={22} /></div>
                    <div className="min-w-0"><span className="block text-[11px] text-[#7e8ba0]">{t('systemData')}</span><strong className="mt-1.5 block text-[26px] font-bold text-[#17233c] dark:text-white">{filteredCount}</strong><small className="mt-1 block text-[9px] text-[#9aa5b7]">{t('currentlyDisplayedResults')}</small></div>
                </div>
            </div>
        </>
    );
}

export default StudentStats;