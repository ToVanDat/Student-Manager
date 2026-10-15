import { Check, Languages } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function LanguageSettings() {
    const { language, setLanguage, t } = useLanguage();
    const options = [
        { value: 'vi', label: t('vietnamese'), detail: 'Vietnamese' },
        { value: 'en', label: t('english'), detail: 'English' },
    ];
    return (
        <section className="min-w-0 rounded-xl border border-line bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 border-b border-slate-100 pb-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><Languages size={20} /></span>
                    <div>
                        <h2 className="m-0 text-base font-bold text-ink dark:text-white">{t('language')}</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('languageDescription')}</p>
                    </div>
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('languageSaved')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {options.map(option => (
                    <button key={option.value} type="button" onClick={() => setLanguage(option.value)} aria-pressed={language === option.value}
                        className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${language === option.value ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40' : 'border-line bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'}`}>
                        <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><Languages size={19} /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{option.label}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{option.detail}</span></span>
                        {language === option.value && <Check size={18} className="text-blue-600 dark:text-blue-300" />}
                    </button>
                ))}
            </div>
        </section>
    );
}
