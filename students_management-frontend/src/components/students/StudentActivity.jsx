function StudentActivity() {
    return (
        <section className="rounded-xl border border-line bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <h2 className="m-0 font-display text-sm font-bold text-ink dark:text-white">Hoạt động gần đây</h2>
            <div className="py-8 text-center">
                <p className="m-0 text-xs font-medium text-slate-600 dark:text-slate-300">Chưa có dữ liệu hoạt động</p>
                <p className="mt-2 mb-0 text-[11px] leading-relaxed text-slate-400">Nhật ký hoạt động sẽ hiển thị khi API ghi nhận lịch sử thao tác được triển khai.</p>
            </div>
        </section>
    );
}

export default StudentActivity;
