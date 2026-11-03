import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, QrCode, ShieldAlert, ShieldCheck, X, Camera, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { generateCompositeSafetyNumber } from '@open-e2ee/signal-protocol-sdk/safety';
import { getE2EEClient, getE2EEClientState, getE2EERelayAdapter } from '@/services/e2ee/e2eeClient';
import { isEncryptionError, EncryptionErrorCode } from '@open-e2ee/signal-protocol-sdk/types';

const formatNumeric = value => String(value || '').replace(/\s+/g, '').match(/.{1,5}/g)?.join(' ') || '';
const decodeQrPayload = value => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        throw new Error('QR không chứa dữ liệu Safety Number SDK hợp lệ.');
    }
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
};

export default function E2EEIdentityVerification({ currentUserId, recipientUserId, recipientName, onClose }) {
    const [loading, setLoading] = useState(true);
    const [safetyNumber, setSafetyNumber] = useState(null);
    const [error, setError] = useState('');
    const [identityChanged, setIdentityChanged] = useState(false);
    const [candidateIdentity, setCandidateIdentity] = useState(null);
    const [saving, setSaving] = useState(false);
    const [verifiedHere, setVerifiedHere] = useState(false);
    const [scanOpen, setScanOpen] = useState(false);
    const [scanMessage, setScanMessage] = useState('');
    const [reloadVersion, setReloadVersion] = useState(0);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const scanFrameRef = useRef(null);
    const scanBusyRef = useRef(false);

    const stopScanner = useCallback(() => {
        if (scanFrameRef.current != null) cancelAnimationFrame(scanFrameRef.current);
        scanFrameRef.current = null;
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setScanOpen(false);
        scanBusyRef.current = false;
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            setIdentityChanged(false);
            setCandidateIdentity(null);
            setSafetyNumber(null);
            setVerifiedHere(false);
            setScanMessage('');
            try {
                const state = getE2EEClientState();
                const client = getE2EEClient();
                const relay = getE2EERelayAdapter();
                if (state.status !== 'local-ready' || !client || !relay) {
                    throw new Error('Thiết bị E2EE chưa sẵn sàng. Hãy đợi khởi tạo E2EE hoàn tất rồi thử lại.');
                }
                if (String(state.userId) !== String(currentUserId)) {
                    throw new Error('Tài khoản E2EE đang hoạt động không khớp tài khoản hiện tại.');
                }

                // verify() is authoritative for the pinned identity and supplies a
                // confirmation token bound to the exact value displayed.
                const verified = await client.verify(String(recipientUserId));
                if (!verified?.confirmation || !verified?.numeric) {
                    throw new Error('SDK không trả về dữ liệu xác minh hợp lệ.');
                }

                // The standalone SDK helper provides the canonical QR/emoji
                // representations. Do not trust relay identity unless it agrees
                // with the identity pinned and checked by client.verify().
                const [localIdentity, remoteIdentity] = await Promise.all([
                    relay.getIdentityKey(String(currentUserId)),
                    relay.getIdentityKey(String(recipientUserId))
                ]);
                const localComposite = localIdentity?.identity_public ?? localIdentity;
                const remoteComposite = remoteIdentity?.identity_public ?? remoteIdentity;
                if (!localComposite || !remoteComposite) {
                    throw new Error('Chưa có đủ public composite identity từ relay để tạo QR Safety Number.');
                }
                const comparison = generateCompositeSafetyNumber(
                    localComposite,
                    remoteComposite,
                    String(currentUserId),
                    String(recipientUserId),
                    verified.identityType || 'aci'
                );
                if (comparison.numeric.replace(/\s/g, '') !== String(verified.numeric).replace(/\s/g, '')) {
                    throw new Error('Safety Number từ relay không khớp với identity đã ghim bởi SDK. Đã dừng xác minh vì lý do bảo mật.');
                }
                if (!cancelled) setSafetyNumber({ ...comparison, confirmation: verified.confirmation, trustState: verified.trustState });
            } catch (loadError) {
                if (!cancelled) {
                    const mismatch = isEncryptionError(loadError) &&
                        loadError.code === EncryptionErrorCode.IDENTITY_MISMATCH;
                    setIdentityChanged(mismatch);
                    setCandidateIdentity(mismatch ? loadError.identity ?? loadError.context?.identity ?? null : null);
                    setError(mismatch
                        ? 'CẢNH BÁO BẢO MẬT: SDK phát hiện identity khác với identity đã ghim. Không tạo mã mới và không tự chấp nhận khóa. Chỉ chấp nhận thay đổi sau khi xác minh người liên hệ qua kênh tin cậy.'
                        : loadError?.response?.data?.message || loadError?.message || 'Không thể tạo mã xác minh E2EE.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        if (currentUserId && recipientUserId) void load();
        return () => { cancelled = true; };
    }, [currentUserId, recipientUserId, reloadVersion]);

    useEffect(() => () => {
        if (scanFrameRef.current != null) cancelAnimationFrame(scanFrameRef.current);
        streamRef.current?.getTracks().forEach(track => track.stop());
    }, []);

    const confirmVerification = async () => {
        if (!safetyNumber?.confirmation || verifiedHere) return;
        const confirmed = window.confirm(
            `Chỉ xác nhận sau khi đã đối chiếu toàn bộ mã với ${recipientName || 'người nhận'} qua một kênh tin cậy khác. Việc chỉ nhìn thấy mã trong ứng dụng không xác minh danh tính.`
        );
        if (!confirmed) return;
        setSaving(true);
        try {
            const client = getE2EEClient();
            if (!client) throw new Error('SDK E2EE không còn sẵn sàng. Hãy mở lại phần xác minh.');
            await client.confirmSafetyNumber(safetyNumber.confirmation);
            setVerifiedHere(true);
            toast.success('SDK đã lưu xác minh danh tính trên thiết bị này.');
        } catch (confirmError) {
            if (isEncryptionError(confirmError) && confirmError.code === EncryptionErrorCode.IDENTITY_MISMATCH) {
                setIdentityChanged(true);
                setSafetyNumber(null);
                setError('CẢNH BÁO: danh tính đã thay đổi hoặc không còn khớp với mã đang hiển thị. Không đánh dấu xác minh; hãy tải lại và kiểm tra thay đổi riêng.');
            } else {
                setError(confirmError?.message || 'Không thể xác nhận mã E2EE.');
            }
            toast.error('Không thể xác nhận mã xác minh E2EE.');
        } finally {
            setSaving(false);
        }
    };

    const acceptRotation = async () => {
        if (!candidateIdentity || !identityChanged) return;
        const accepted = window.confirm(
            'Đây là thay đổi khóa danh tính, không phải bước xác minh. Chỉ tiếp tục nếu bạn đã xác minh danh tính người liên hệ qua một kênh tin cậy độc lập. Sau khi chấp nhận, bạn vẫn phải đối chiếu Safety Number mới.'
        );
        if (!accepted) return;
        setSaving(true);
        try {
            const client = getE2EEClient();
            if (!client?.acceptIdentityRotation) throw new Error('Phiên bản SDK hiện tại không hỗ trợ chấp nhận identity rotation.');
            await client.acceptIdentityRotation(String(recipientUserId), candidateIdentity);
            setIdentityChanged(false);
            setCandidateIdentity(null);
            setError('');
            setReloadVersion(value => value + 1);
            toast.warning('Đã chấp nhận identity rotation. Danh tính CHƯA được xác minh; hãy đối chiếu Safety Number mới.');
        } catch (rotationError) {
            setError(rotationError?.message || 'Không thể chấp nhận thay đổi danh tính.');
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

    const startScanner = async () => {
        setScanMessage('');
        if (!('BarcodeDetector' in window)) {
            setScanMessage('Trình duyệt này không hỗ trợ quét QR trực tiếp. Hãy dùng ứng dụng camera/QR đáng tin cậy để đọc payload hoặc đối chiếu 60 chữ số.');
            return;
        }
        try {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
            streamRef.current = stream;
            setScanOpen(true);
            requestAnimationFrame(async function scanFrame() {
                if (!streamRef.current || !videoRef.current || scanBusyRef.current) return;
                if (videoRef.current.readyState >= 2) {
                    try {
                        const codes = await detector.detect(videoRef.current);
                        const raw = codes.find(code => code.rawValue)?.rawValue;
                        if (raw) {
                            scanBusyRef.current = true;
                            try {
                                const bytes = decodeQrPayload(raw);
                                const result = safetyNumber?.scannable?.compare(bytes);
                                if (result === 'match') {
                                    await getE2EEClient().confirmSafetyNumber(safetyNumber.confirmation);
                                    setVerifiedHere(true);
                                    setScanMessage('QR khớp. SDK đã ghi nhận xác minh trên thiết bị này.');
                                    toast.success('Đã xác minh Safety Number bằng QR.');
                                    stopScanner();
                                    return;
                                }
                                setScanMessage(result === 'version_mismatch' ? 'QR dùng phiên bản Safety Number khác.' : 'QR không khớp với danh tính này. Không xác minh.');
                            } catch (scanError) {
                                setScanMessage(scanError?.message || 'Không đọc được payload Safety Number.');
                            } finally {
                                scanBusyRef.current = false;
                            }
                        }
                    } catch {
                        // Camera frames may be temporarily undecodable; keep scanning.
                    }
                }
                scanFrameRef.current = requestAnimationFrame(scanFrame);
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
        } catch (scanError) {
            stopScanner();
            setScanMessage(scanError?.name === 'NotAllowedError'
                ? 'Bạn chưa cấp quyền camera. Hãy cho phép camera hoặc đối chiếu mã số thủ công.'
                : scanError?.message || 'Không thể khởi động máy quét QR.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) { stopScanner(); onClose?.(); } }}>
            <section role="dialog" aria-modal="true" aria-labelledby="e2ee-identity-title" className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="e2ee-identity-title" className="text-lg font-bold text-slate-900 dark:text-white">Mã xác minh E2EE</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{recipientName || 'Người nhận'} · Safety Number của SDK</p>
                    </div>
                    <button type="button" onClick={() => { stopScanner(); onClose?.(); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Đóng"><X size={18} /></button>
                </header>

                {loading ? (
                    <p className="py-8 text-sm text-slate-500">Đang yêu cầu SDK tạo mã xác minh…</p>
                ) : error ? (
                    <div className={`mt-4 flex items-start gap-3 rounded-xl p-3 text-sm ${identityChanged ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                        <ShieldAlert size={20} className="mt-0.5 shrink-0" />
                        <div>
                            <p>{error}</p>
                            {identityChanged && candidateIdentity && (
                                <button type="button" disabled={saving} onClick={acceptRotation} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold disabled:opacity-50">
                                    <RotateCcw size={14} /> {saving ? 'Đang xử lý…' : 'Tôi đã xác minh qua kênh tin cậy — chấp nhận khóa mới'}
                                </button>
                            )}
                        </div>
                    </div>
                ) : safetyNumber ? (
                    <>
                        <div className={`mt-4 flex items-start gap-3 rounded-xl p-3 text-sm ${verifiedHere ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                            {verifiedHere ? <ShieldCheck size={20} className="mt-0.5 shrink-0" /> : <ShieldAlert size={20} className="mt-0.5 shrink-0" />}
                            <p>{verifiedHere ? 'Đã xác minh bằng SDK trên thiết bị này. Trạng thái tin cậy không tự động đồng bộ sang thiết bị khác.' : 'Chưa xác minh. Hãy so sánh mã hoặc quét QR của người nhận qua một kênh tin cậy khác.'}</p>
                        </div>
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                            <p className="break-all font-mono text-sm leading-7 tracking-wide text-slate-900 dark:text-slate-100">{formatNumeric(safetyNumber.numeric)}</p>
                            {safetyNumber.emojis && <p className="mt-3 break-words text-xl leading-8" aria-label="Biểu tượng đối chiếu">{safetyNumber.emojis}</p>}
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <button type="button" onClick={copySafetyNumber} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800"><Copy size={14} /> Sao chép mã</button>
                                <button type="button" onClick={scanOpen ? stopScanner : startScanner} disabled={verifiedHere || saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-white disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"><Camera size={14} /> {scanOpen ? 'Dừng quét QR' : 'Quét QR người nhận'}</button>
                            </div>
                        </div>
                        {safetyNumber.qrData && (
                            <div className="mt-4 flex flex-col items-center rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                                <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold"><QrCode size={16} /> QR Safety Number</p>
                                <QRCodeSVG value={safetyNumber.qrData} size={200} level="M" includeMargin />
                                <p className="mt-2 text-center text-xs text-slate-500">QR chứa dữ liệu protobuf do SDK tạo, không phải chuỗi số tự chuyển đổi.</p>
                            </div>
                        )}
                        {scanOpen && <video ref={videoRef} muted playsInline className="mt-3 max-h-64 w-full rounded-xl bg-black object-cover" aria-label="Camera quét QR" />}
                        {scanMessage && <p role="status" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{scanMessage}</p>}
                        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Mã được tạo bằng API Safety Number của SDK từ composite identity của hai bên. Chấp nhận thay đổi khóa không đồng nghĩa xác minh danh tính.</p>
                        {!verifiedHere && (
                            <button type="button" disabled={saving} onClick={confirmVerification} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                                <Check size={16} /> {saving ? 'Đang xác nhận…' : 'Tôi đã đối chiếu mã với người nhận'}
                            </button>
                        )}
                    </>
                ) : null}
                <footer className="mt-4 flex justify-end">
                    <button type="button" onClick={() => { stopScanner(); onClose?.(); }} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Đóng</button>
                </footer>
            </section>
        </div>
    );
}
