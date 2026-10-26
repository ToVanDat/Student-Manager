import { Search, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

function StudentSearch({ value, onChange }) {
    const { t } = useLanguage();
    return (
        <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex h-11 min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-slate-400 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950">
                <Search size={17} className="shrink-0" />
                <input
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                    placeholder={t("searchStudentsShort")}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                {value && <button className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => onChange('')} aria-label={t("clearSearch")}><X size={15} /></button>}
            </div>
        </div>
    );
}

export default StudentSearch;