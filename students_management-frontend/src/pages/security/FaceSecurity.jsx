import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Fingerprint, ShieldCheck, ShieldAlert, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getFaceCredentialApi, revokeFaceCredentialApi } from '@/api/faceAuthApi.js';

export default function FaceSecurity() {
  const navigate = useNavigate();
  const [credential, setCredential] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');

  const loadCredential = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCredential(await getFaceCredentialApi());
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải trạng thái xác thực khuôn mặt.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCredential(); }, [loadCredential]);

  const revoke = async () => {
    if (!window.confirm('Tắt dữ liệu xác thực khuôn mặt cho tài khoản này? Thao tác này không xóa tài khoản hoặc lịch sử chat.')) return;
    setRevoking(true);
    try {
      await revokeFaceCredentialApi();
      setCredential(null);
      toast.success('Đã vô hiệu hóa thông tin xác thực khuôn mặt.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể vô hiệu hóa lúc này.');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Quay lại
        </button>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-6 sm:p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Fingerprint size={25} /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Bảo mật tài khoản</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Xác thực khuôn mặt</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Quản lý trạng thái thông tin khuôn mặt được liên kết với tài khoản. Tính năng đăng nhập bằng khuôn mặt chưa được bật cho đến khi mô hình nhận diện, kiểm tra chống giả mạo và xác minh phía máy chủ được hoàn thiện.</p>
          </header>
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <ShieldAlert className="mt-0.5 shrink-0 text-amber-700" size={20} />
              <div>
                <p className="font-medium text-amber-900">Chưa sẵn sàng để dùng đăng nhập</p>
                <p className="mt-1 text-sm leading-5 text-amber-800">Không nhập hoặc tải ảnh khuôn mặt lên trang này. Không dùng embedding do trình duyệt gửi lên làm bằng chứng duy nhất để cấp phiên đăng nhập.</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-slate-500" size={21} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">Thông tin xác thực đã lưu</h2>
                  <p className="mt-1 text-sm text-slate-500">Chỉ hiển thị metadata; không tải template sinh trắc học về trình duyệt.</p>
                </div>
                <button onClick={() => void loadCredential()} disabled={loading} aria-label="Làm mới trạng thái" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
              </div>
              <div className="mt-4">
                {loading ? <p className="text-sm text-slate-500">Đang kiểm tra…</p>
                  : error ? <p role="alert" className="text-sm text-rose-700">{error}</p>
                    : credential ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1">
                          <p className="font-medium text-emerald-700">Có thông tin xác thực đang hoạt động</p>
                          <p className="mt-1 text-xs text-slate-500">Mô hình: {credential.embedding_model || 'Chưa rõ'} · Phiên bản: {credential.embedding_model_version || 'Chưa rõ'}</p>
                        </div>
                        <button onClick={revoke} disabled={revoking} className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={16} />{revoking ? 'Đang tắt…' : 'Vô hiệu hóa'}</button>
                      </div>
                    ) : <p className="text-sm text-slate-600">Chưa có thông tin xác thực khuôn mặt đang hoạt động.</p>}
              </div>
            </div>

            <div className="mt-6 text-sm leading-6 text-slate-600">
              <h2 className="font-semibold text-slate-900">Trước khi bật tính năng</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Chọn mô hình embedding và xác minh giấy phép sử dụng.</li>
                <li>Kiểm thử độ chính xác, false accept/false reject và liveness với dữ liệu đại diện.</li>
                <li>Thiết kế challenge chống replay và xác minh độc lập phía máy chủ.</li>
                <li>Giữ đăng nhập bằng mật khẩu/passkey làm phương án dự phòng.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
