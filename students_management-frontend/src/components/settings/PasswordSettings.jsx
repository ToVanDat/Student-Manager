import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

const fields = [
    ['currentPassword', 'Mật khẩu hiện tại', 'current-password'],
    ['newPassword', 'Mật khẩu mới', 'new-password'],
    ['confirmPassword', 'Xác nhận mật khẩu mới', 'new-password'],
];

function PasswordSettings({ form, onChange, onSubmit, saving, message, error }) {
    return (
        <div className="min-w-0 rounded-xl border border-line bg-white p-5 shadow-panel sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-blue-950 dark:text-blue-300"><KeyRound size={20} /></div>
                <div><h2 className="m-0 font-display text-base font-bold text-ink dark:text-white">Đổi mật khẩu</h2><p className="mt-1 mb-0 text-xs text-muted">Sử dụng mật khẩu mạnh và không chia sẻ mật khẩu với người khác.</p></div>
            </div>
            <form className="grid gap-4" onSubmit={onSubmit}>
                {fields.map(([name, label, autoComplete]) => (
                    <div className="grid gap-2" key={name}>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</label>
                        <div className="flex min-h-[46px] items-center gap-2.5 rounded-lg border border-line bg-slate-50 px-3 transition focus-within:border-brand-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950">
                            <KeyRound size={17} className="shrink-0 text-slate-400" />
                            <input className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" type="password" value={form[name]} onChange={(event) => onChange({ ...form, [name]: event.target.value })} autoComplete={autoComplete} />
                        </div>
                    </div>
                ))}
                {error && <div className="flex items-center gap-2 rounded-md bg-red-50 px-3.5 py-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-200"><AlertCircle size={17} />{error}</div>}
                {message && <div className="flex items-center gap-2 rounded-md bg-green-50 px-3.5 py-3 text-xs text-green-800 dark:bg-green-950/40 dark:text-green-200"><CheckCircle2 size={17} />{message}</div>}
                <div className="grid gap-1 rounded-md bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"><strong className="mb-1 text-slate-800 dark:text-white">Yêu cầu mật khẩu</strong><span>• Ít nhất 8 ký tự</span><span>• Không sử dụng mật khẩu quá dễ đoán</span></div>
                <div className="mt-1 flex justify-end"><button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-linear-to-r from-brand-600 to-brand-500 px-4 text-xs font-semibold text-white shadow-md shadow-brand-600/20 hover:-translate-y-px hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50" disabled={saving}><KeyRound size={17} />{saving ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</button></div>
            </form>
        </div>
    );
}

export default PasswordSettings;