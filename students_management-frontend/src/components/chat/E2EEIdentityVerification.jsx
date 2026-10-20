import { useEffect, useState } from 'react';
import { Check, Copy, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { getE2EEClient, getE2EEClientState } from '@/services/e2ee/e2eeClient';
import { isEncryptionError, EncryptionErrorCode } from '@open-e2ee/signal-protocol-sdk/types';

const formatNumeric = value => String(value || '').replace(/\s+/g, '').match(/.{1,5}/g)?.join(' ') || '';

export default function E2EEIdentityVerification({ currentUserId, recipientUserId, recipientName, onClose }) {
    const [loading, setLoading] = useState(true);
    const [safetyNumber, setSafetyNumber] = useState(null);
    const [error, setError] = useState('');
    const [identityChanged, setIdentityChanged] = useState(false);
    const [saving, setSaving] = useState(false);
    const [verifiedHere, setVerifiedHere] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            setIdentityChanged(false);
            setSafetyNumber(null);
            setVerifiedHere(false);
            try {
                const state = getE2EEClientState();
                const client = getE2EEClient();
                if (state.status !== 'local-ready' || !client) {
                    throw new Error('Thiết bị E2EE chưa sẵn sàng. Hãy đợi khởi tạo E2EE hoàn tất rồi thử lại.');
                }
                if (String(state.userId) !== String(currentUserId)) {
                    throw new Error('Tài khoản E2EE đang hoạt động không khớp tài khoản hiện tại.');
                }
                // Use the SDK's pinned identity and verification token. Do not hash
                // relay JSON or invent a project-specific fingerprint.
                const result = await client.verify(String(recipientUserId));
                if (!result?.confirmation || !result?.numeric) {
                    throw new Error('SDK không trả về dữ liệu xác minh hợp lệ.');
                }
                if (!cancelled) setSafetyNumber(result);
            } catch (loadError) {
                if (!cancelled) {
                    const mismatch = isEncryptionError(loadError) &&
                        loadError.code === EncryptionErrorCode.IDENTITY_MISMATCH;
                    setIdentityChanged(mismatch);
                    setError(mismatch
                        ? 'CẢNH BÁO BẢO MẬT: khóa danh tính của người này khác với khóa đã ghim trên thiết bị. Mã mới chưa được hiển thị và việc xác minh không được tự động chấp nhận. Hãy xác minh thay đổi danh tính qua một kênh tin cậy trước khi tiếp tục.'
                        : loadError?.response?.data?.message || loadError?.message || 'Không thể tạo mã xác minh E2EE.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        if (currentUserId && recipientUserId) void load();
        return () => { cancelled = true; };
    }, [currentUserId, recipientUserId]);

    const confirmVerification = async () => {
        if (!safetyNumber?.confirmation) return;
        const confirmed = window.confirm(
            `Chỉ xác nhận sau khi đã đối chiếu toàn bộ mã với ${recipientName || 'người nhận'} qua một kênh tin cậy khác. Việc chỉ nhìn thấy mã trong ứng dụng không xác minh danh tính.`
        );
        if (!confirmed) return;
        setSaving(true);
        try {
            const client = getE2EEClient();
            if (!client) throw new Error('SDK E2EE không còn sẵn sàng. Hãy mở lại phần xác minh.');
            // The SDK checks that this token still refers to the exact identity and
            // comparison value that were shown. It persists trust in its local store.
            await client.confirmSafetyNumber(safetyNumber.confirmation);
            setVerifiedHere(true);
            toast.success('SDK đã lưu xác minh danh tính trên thiết bị này.');
        } catch (confirmError) {
            if (isEncryptionError(confirmError) &&
                confirmError.code === EncryptionErrorCode.IDENTITY_MISMATCH) {
                setIdentityChanged(true);
                setSafetyNumber(null);
                setError('CẢNH BÁO: danh tính đã thay đổi hoặc không còn khớp với mã đang hiển thị. Không đánh dấu xác minh; hãy tải lại và xác minh thay đổi riêng.');
            } else {
                setError(confirmError?.message || 'Không thể xác nhận mã E2EE.');
            }
            toast.error('Không thể xác nhận mã xác minh E2EE.');
        } finally {
            setSaving(false);
        }
    };

    const copySafetyNumber = async () => {
        const value = formatNumeric(safetyNumber?.numeric);
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            toast.success('Đã sao chép mã xác minh E2EE.');
        } catch {
            toast.error('Không thể sao chép mã. Hãy chọn và sao chép thủ công.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="e2ee-identity-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="e2ee-identity-title" className="text-lg font-bold text-slate-900 dark:text-white">Mã xác minh E2EE</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{recipientName || 'Người nhận'} · Safety Number của SDK</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Đóng"><X size={18} /></button>
                </header>

                {loading ? (
                    <p className="py-8 text-sm text-slate-500">Đang yêu cầu SDK tạo mã xác minh…</p>
                ) : error ? (
                    <div className={`mt-4 flex items-start gap-3 rounded-xl p-3 text-sm ${identityChanged ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                        <ShieldAlert size={20} className="mt-0.5 shrink-0" />
                        <p>{error}</p>
                    </div>
                ) : safetyNumber ? (
                    <>
                        <div className={`mt-4 flex items-start gap-3 rounded-xl p-3 text-sm ${verifiedHere ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                            {verifiedHere ? <ShieldCheck size={20} className="mt-0.5 shrink-0" /> : <ShieldAlert size={20} className="mt-0.5 shrink-0" />}
                            <p>{verifiedHere ? 'Đã xác minh bằng SDK trên thiết bị này. Trạng thái tin cậy không tự động đồng bộ sang thiết bị khác.' : 'Chưa xác minh. Hãy so sánh toàn bộ mã với người nhận qua một kênh tin cậy khác trước khi xác nhận.'}</p>
                        </div>
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                            <p className="break-all font-mono text-sm leading-7 tracking-wide text-slate-900 dark:text-slate-100">{formatNumeric(safetyNumber.numeric)}</p>
                            {Array.isArray(safetyNumber.emojis) && safetyNumber.emojis.length > 0 && (
                                <p className="mt-3 break-words text-xl leading-8" aria-label="Biểu tượng đối chiếu">{safetyNumber.emojis.join(' ')}</p>
                            )}
                            <button type="button" onClick={copySafetyNumber} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800"><Copy size={14} /> Sao chép mã</button>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Mã được tạo bởi SDK `@open-e2ee/signal-protocol-sdk` từ identity đã ghim của cả hai bên. Mã không phải mật khẩu hay khóa mã hóa. Không xác nhận nếu hai bên không khớp hoàn toàn.</p>
                        {!verifiedHere && (
                            <button type="button" disabled={saving} onClick={confirmVerification} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                                <Check size={16} /> {saving ? 'Đang xác nhận…' : 'Tôi đã đối chiếu mã với người nhận'}
                            </button>
                        )}
                    </>
                ) : null}
                <footer className="mt-4 flex justify-end">
                    <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Đóng</button>
                </footer>
            </section>
        </div>
    );
}
