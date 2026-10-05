function StudentClassStatistics({ classStatistics }) {
    const maxCount = Math.max(0, ...classStatistics.map((item) => item.count));

    return (
        <div className="rounded-xl border border-line bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="m-0 font-display text-sm font-bold text-ink dark:text-white">Sinh viên theo lớp</h2>
            <button className="rounded px-1 py-1 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800">Xem chi tiết</button>
            </div>
            <div className="grid gap-4">
                {classStatistics.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">Chưa có dữ liệu lớp</div>
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