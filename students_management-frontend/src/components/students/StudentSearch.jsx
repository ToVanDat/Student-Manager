import { Search, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

function StudentSearch({ value, onChange }) {
    const { t } = useLanguage();
    return (
        <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex h-11 min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-slate-400 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950">
                <Search size={17} className="shrink-0" />
                <input
                    type="search"
                    inputMode="search"
                    aria-label={t("searchStudentsShort")}
                    className="min-w-0 flex-1 border-0 bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 sm:text-sm"
                    placeholder={t("searchStudentsShort")}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                {value && <button type="button" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:hover:bg-slate-800" onClick={() => onChange('')} aria-label={t("clearSearch")}><X size={15} /></button>}
            </div>
        </div>
    );
}

export default StudentSearch;