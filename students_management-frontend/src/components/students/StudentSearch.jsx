import { ArrowUpDown, Filter, Search, X } from 'lucide-react';

function StudentSearch({ value, onChange }) {
    return (
        <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-950">
                <Search size={17} className="shrink-0" />
                <input
                    className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                    placeholder="Tìm theo mã, tên, email..."
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                {value && <button className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => onChange('')} aria-label="Xóa tìm kiếm"><X size={15} /></button>}
            </div>
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><Filter size={16} />Bộ lọc</button>
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><ArrowUpDown size={16} />Sắp xếp</button>
        </div>
    );
}

export default StudentSearch;