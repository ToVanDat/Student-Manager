import { useLanguage } from '@/context/LanguageContext.jsx';

export default function AuthStepper({ steps, currentStep }) {
    const { t } = useLanguage();
    const progress = steps.length > 1 ? (currentStep / (steps.length - 1)) * 100 : 100;

    return (
        <nav aria-label={t('authProgress')} className="mb-6 w-full">
            <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {t('authStepOf', { current: currentStep + 1, total: steps.length })}
                </span>
                <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t(steps[currentStep])}
                </span>
            </div>
            <div
                className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 md:hidden"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuenow={currentStep + 1}
                aria-label={t('authProgress')}
            >
                <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-300 ease-out motion-reduce:transition-none"
                    style={{ width: `${progress === 0 ? 8 : progress}%` }}
                />
            </div>
            <ol className="hidden items-start md:flex">
                {steps.map((step, index) => {
                    const completed = index < currentStep;
                    const active = index === currentStep;
                    return (
                        <li key={step} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
                            {index > 0 && (
                                <span
                                    aria-hidden="true"
                                    className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${completed ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                />
                            )}
                            <span
                                aria-current={active ? 'step' : undefined}
                                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors motion-reduce:transition-none ${
                                    completed
                                        ? 'border-blue-600 bg-blue-600 text-white'
                                        : active
                                            ? 'border-blue-600 bg-white text-blue-700 ring-4 ring-blue-100 dark:bg-slate-900 dark:text-blue-300 dark:ring-blue-950'
                                            : 'border-slate-300 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400'
                                }`}
                            >
                                {completed ? '✓' : index + 1}
                            </span>
                            <span className={`mt-2 max-w-[9rem] text-[11px] font-semibold leading-4 ${active ? 'text-blue-700 dark:text-blue-300' : completed ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                                {t(step)}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
