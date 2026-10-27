import { useCallback, useEffect, useState } from 'react';
import { Camera, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react';
import { disableFaceLoginApi, getFaceLoginStatusApi } from '@/api/authApi.js';

export default function FaceLoginSettings() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const refresh = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setStatus(await getFaceLoginStatusApi());
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Không thể tải trạng thái Face Login.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const disable = async () => {
        if (!window.confirm('Vô hiệu hóa Face Login trên tài khoản này?')) return;
        setBusy(true);
        setError('');
        try {
            await disableFaceLoginApi();
            await refresh();
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Không thể vô hiệu hóa Face Login.');
        } finally {
            setBusy(false);
        }
    };

    const configured = Boolean(status?.configured);
    const available = Boolean(status?.enrollmentAvailable && status?.loginAvailable);

    return (
        <section className="mb-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:p-5">
            <div className="mb-2 flex items-center gap-2">
                <Camera size={19} className="text-indigo-600" />
                <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">Face Login · Nhận diện khuôn mặt</h3>
                <span className={configured
                    ? 'ml-auto rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}>
                    {loading ? 'Đang tải…' : configured ? 'Đã đăng ký' : 'Chưa thiết lập'}
                </span>
            </div>
            <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Đây là tính năng nhận diện khuôn mặt riêng của Student Manager, khác với Passkey/Face ID của hệ điều hành.
                Camera chỉ được sử dụng khi bạn chủ động bắt đầu đăng ký hoặc đăng nhập. Ảnh camera không được lưu trong cơ sở dữ liệu.
            </p>
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                <span>
                    {available
                        ? 'Hệ thống đã sẵn sàng cho đăng ký và đăng nhập khuôn mặt.'
                        : 'Chưa bật đăng ký/đăng nhập: cần hoàn thiện inference và PAD ở phía server. Không chấp nhận embedding hoặc điểm liveness do trình duyệt tự gửi vì có thể bị giả mạo.'}
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy || loading || !available}
                    title={!available ? 'Đang chờ hoàn thiện xác minh model phía server' : 'Đăng ký khuôn mặt'}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
                    <Camera size={15} /> Đăng ký khuôn mặt
                </button>
                {configured && <button type="button" disabled={busy || loading} onClick={disable}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">
                    <Trash2 size={14} /> Vô hiệu hóa
                </button>}
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><ShieldCheck size={13} /> Challenge một lần · AES-256-GCM</span>
            </div>
            {status?.credential?.enrolledAt && <p className="mb-0 mt-3 text-[11px] text-slate-400">Đăng ký: {new Date(status.credential.enrolledAt).toLocaleString()}</p>}
            {error && <p role="alert" className="mb-0 mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        </section>
    );
}
