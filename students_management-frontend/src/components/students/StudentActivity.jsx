import { useLanguage } from '@/context/LanguageContext.jsx';

function StudentActivity() {
    const { t } = useLanguage();
    return (
        <section className="rounded-xl border border-line bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <h2 className="m-0 font-display text-sm font-bold text-ink dark:text-white">{t('recentActivity')}</h2>
            <div className="py-8 text-center">
                <p className="m-0 text-xs font-medium text-slate-600 dark:text-slate-300">{t('noActivityData')}</p>
                <p className="mt-2 mb-0 text-[11px] leading-relaxed text-slate-400">{t('activityLogHint')}</p>
            </div>
        </section>
    );
}

export default StudentActivity;
