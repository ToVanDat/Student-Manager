import { useEffect, useState } from 'react';
import { openDB } from 'idb';
import { Check, Copy, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { e2eeRelayApi } from '@/api/e2eeRelayApi';

const dbName = userId => `student-manager-e2ee-trust-user-${String(userId)}`;

const openTrustDb = userId => openDB(dbName(userId), 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('identities')) {
            db.createObjectStore('identities', { keyPath: 'recipientUserId' });
        }
    }
});

const canonicalize = value => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
    }
    return value;
};

const getFingerprint = async identity => {
    const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(identity)));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
};

const formatFingerprint = fingerprint => fingerprint.match(/.{1,4}/g)?.join(' ') || fingerprint;

export default function E2EEIdentityVerification({ currentUserId, recipientUserId, recipientName, onClose }) {
    const [loading, setLoading] = useState(true);
    const [fingerprint, setFingerprint] = useState('');
    const [savedFingerprint, setSavedFingerprint] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await e2eeRelayApi.getIdentityKey(recipientUserId, 'aci');
                const identity = response.data?.data;
                if (!identity || typeof identity !== 'object') {
                    throw new Error('Người nhận chưa có identity key E2EE được đăng ký.');
                }
                const nextFingerprint = await getFingerprint(identity);
                const db = await openTrustDb(currentUserId);
                let record;
                try {
                    record = await db.get('identities', String(recipientUserId));
                } finally {
                    db.close();
                }
                if (!cancelled) {
                    setFingerprint(nextFingerprint);
                    setSavedFingerprint(record?.fingerprint || null);
                }
            } catch (loadError) {
                if (!cancelled) setError(loadError?.response?.data?.message || loadError?.message || 'Không thể tải khóa danh tính.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        if (currentUserId && recipientUserId) void load();
        return () => { cancelled = true; };
    }, [currentUserId, recipientUserId]);

    const changed = Boolean(savedFingerprint && fingerprint && savedFingerprint !== fingerprint);
    const verified = Boolean(savedFingerprint && fingerprint && savedFingerprint === fingerprint);

    const markVerified = async () => {
        if (!fingerprint || !currentUserId || !recipientUserId) return;
        const confirmed = window.confirm(
            `Chỉ xác nhận sau khi bạn đã so sánh toàn bộ mã an toàn này với ${recipientName || 'người nhận'} qua một kênh tin cậy khác (gặp trực tiếp hoặc cuộc gọi đã xác thực). Nếu chưa so sánh, hãy hủy.`
        );
        if (!confirmed) return;
        setSaving(true);
        try {
            const db = await openTrustDb(currentUserId);
            try {
                await db.put('identities', {
                    recipientUserId: String(recipientUserId),
                    fingerprint,
                    verifiedAt: new Date().toISOString()
                });
            } finally {
                db.close();
            }
            setSavedFingerprint(fingerprint);
            toast.success('Đã lưu trạng thái xác minh trên thiết bị này.');
        } catch {
            toast.error('Không thể lưu trạng thái xác minh trên thiết bị này.');
        } finally {
            setSaving(false);
        }
    };

    const copyFingerprint = async () => {
        try {
            await navigator.clipboard.writeText(formatFingerprint(fingerprint));
            toast.success('Đã sao chép mã an toàn.');
        } catch {
            toast.error('Không thể sao chép mã. Hãy chọn và sao chép thủ công.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="e2ee-identity-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="e2ee-identity-title" className="text-lg font-bold text-slate-900 dark:text-white">Xác minh danh tính E2EE</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{recipientName || 'Người nhận'} · Mã an toàn (SHA-256)</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Đóng"><X size={18} /></button>
                </header>

                {loading ? (
                    <p className="py-8 text-sm text-slate-500">Đang tải khóa danh tính…</p>
                ) : error ? (
                    <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>
                ) : (
                    <>
                        <div className={`mt-4 flex items-start gap-3 rounded-xl p-3 text-sm ${changed ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' : verified ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                            {changed ? <ShieldAlert size={20} className="mt-0.5 shrink-0" /> : verified ? <ShieldCheck size={20} className="mt-0.5 shrink-0" /> : <ShieldAlert size={20} className="mt-0.5 shrink-0" />}
                            <p>{changed ? 'CẢNH BÁO: khóa danh tính khác với khóa bạn đã xác minh trước đây. Đừng tiếp tục chia sẻ thông tin nhạy cảm cho đến khi xác minh lại.' : verified ? 'Mã này khớp với mã bạn đã xác minh trên thiết bị này. Đây không phải xác minh đồng bộ giữa các thiết bị.' : 'Chưa xác minh. Hãy so sánh mã này với người nhận qua một kênh tin cậy khác; chỉ nhìn mã trên cùng máy chủ không đủ để xác minh.'}</p>
                        </div>
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                            <p className="break-all font-mono text-sm leading-7 tracking-wide text-slate-900 dark:text-slate-100">{formatFingerprint(fingerprint)}</p>
                            <button type="button" onClick={copyFingerprint} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800"><Copy size={14} /> Sao chép mã</button>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Mã được tính từ public identity key mà relay trả về. Trạng thái xác minh được lưu cục bộ trên trình duyệt này. Đây là TOFU + xác minh thủ công; chưa thay thế kiểm toán SDK hoặc cơ chế xác minh danh tính đa thiết bị.</p>
                        {!verified && (
                            <button type="button" disabled={saving} onClick={markVerified} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                                <Check size={16} /> {saving ? 'Đang lưu…' : changed ? 'Xác minh lại sau khi so sánh' : 'Đã so sánh mã an toàn'}
                            </button>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
