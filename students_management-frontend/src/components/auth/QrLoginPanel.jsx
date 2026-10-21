import { useEffect, useRef, useState } from 'react';
import { QrCode, Camera, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { approveQrLoginApi, createQrLoginApi, pollQrLoginApi } from '@/api/authApi.js';

function parsePayload(value) {
    try {
        const parsed = JSON.parse(value);
        if (parsed?.type === 'student-manager-qr-login' && parsed.requestId && parsed.secret) return parsed;
    } catch {}
    try {
        const url = new URL(value);
        const requestId = url.searchParams.get('requestId');
        const secret = url.searchParams.get('secret');
        if (requestId && secret) return { requestId, secret };
    } catch {}
    return null;
}

export default function QrLoginPanel({ onLogin, allowApprove = false, approvalOnly = false }) {
    const [mode, setMode] = useState(approvalOnly ? 'approve' : 'login');
    const [request, setRequest] = useState(null);
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [manualPayload, setManualPayload] = useState('');
    const [cameraError, setCameraError] = useState('');
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const frameRef = useRef(null);

    const createRequest = async () => {
        setBusy(true);
        setStatus('');
        try {
            const result = await createQrLoginApi();
            setRequest(result);
            setStatus('Đang chờ xác nhận trên thiết bị đã đăng nhập.');
        } catch (error) {
            setStatus(error.response?.data?.message || 'Không tạo được yêu cầu QR.');
        } finally { setBusy(false); }
    };

    useEffect(() => {
        if (mode !== 'login' || !request) return undefined;
        let active = true;
        const poll = async () => {
            try {
                const result = await pollQrLoginApi(request.requestId, request.secret);
                if (!active) return;
                if (result.status === 'consumed' && result.accessToken) {
                    setStatus('Đăng nhập QR thành công.');
                    onLogin?.(result);
                    setRequest(null);
                    return;
                }
                if (['denied', 'cancelled', 'expired'].includes(result.status)) {
                    setStatus(result.status === 'denied' ? 'Yêu cầu đã bị từ chối.' : result.status === 'expired' ? 'QR đã hết hạn.' : 'Yêu cầu đã bị hủy.');
                    setRequest(null);
                }
            } catch (error) {
                if (active && error.response?.status >= 400) setStatus(error.response?.data?.message || 'Không thể kiểm tra trạng thái QR.');
            }
        };
        const timer = window.setInterval(poll, 2000);
        void poll();
        return () => { active = false; window.clearInterval(timer); };
    }, [mode, request, onLogin]);

    useEffect(() => {
        if (mode !== 'approve' || !allowApprove || !videoRef.current) return undefined;
        let active = true;
        const scan = async () => {
            if (!active || !videoRef.current) return;
            try {
                if (!('BarcodeDetector' in window)) {
                    setCameraError('Trình duyệt này chưa hỗ trợ quét QR trực tiếp. Hãy dán nội dung QR vào ô bên dưới.');
                    return;
                }
                const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                const codes = await detector.detect(videoRef.current);
                if (codes.length && active) {
                    const payload = parsePayload(codes[0].rawValue);
                    if (payload) {
                        active = false;
                        await approvePayload(payload);
                        return;
                    }
                }
            } catch {
                if (active) setCameraError('Không thể đọc QR. Hãy kiểm tra quyền camera hoặc nhập thủ công.');
            }
            if (active) frameRef.current = window.requestAnimationFrame(scan);
        };
        let stream;
        navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
            .then(value => {
                if (!active) { value.getTracks().forEach(track => track.stop()); return; }
                stream = value;
                streamRef.current = value;
                if (videoRef.current) videoRef.current.srcObject = value;
                return videoRef.current?.play();
            })
            .then(() => { if (active) void scan(); })
            .catch(() => setCameraError('Không truy cập được camera. Hãy cho phép quyền camera hoặc nhập thủ công.'));
        return () => {
            active = false;
            if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
            (stream || streamRef.current)?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        };
    }, [mode, allowApprove]);

    const approvePayload = async payload => {
        if (!window.confirm('Bạn có chắc muốn cấp quyền đăng nhập cho thiết bị đang hiển thị QR này? Chỉ xác nhận nếu bạn tự khởi tạo yêu cầu.')) return;
        setBusy(true);
        setStatus('');
        try {
            await approveQrLoginApi(payload.requestId, payload.secret);
            setStatus('Đã xác nhận. Thiết bị mới sẽ nhận phiên đăng nhập.');
        } catch (error) {
            setStatus(error.response?.data?.message || 'Không thể xác nhận QR.');
        } finally { setBusy(false); }
    };

    const submitManual = async event => {
        event.preventDefault();
        const payload = parsePayload(manualPayload.trim());
        if (!payload) { setStatus('Nội dung QR không hợp lệ.'); return; }
        await approvePayload(payload);
        setManualPayload('');
    };

    const qrValue = request ? JSON.stringify({
        type: 'student-manager-qr-login',
        requestId: request.requestId,
        secret: request.secret,
        expiresAt: request.expiresAt
    }) : '';

    return (
        <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="mb-3 flex items-center gap-2">
                <QrCode size={18} className="text-blue-600" />
                <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">Đăng nhập bằng QR</h3>
            </div>
            {allowApprove && !approvalOnly && (
                <div className="mb-4 flex gap-2">
                    <button type="button" onClick={() => { setMode('login'); setCameraError(''); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === 'login' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>Hiển thị QR</button>
                    <button type="button" onClick={() => { setMode('approve'); setCameraError(''); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === 'approve' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>Quét để xác nhận</button>
                </div>
            )}
            {mode === 'login' && !approvalOnly && (
                <div className="flex flex-col items-center gap-3">
                    {request ? <QRCodeSVG value={qrValue} size={208} level="M" includeMargin /> : (
                        <button type="button" onClick={createRequest} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50">
                            <QrCode size={16} /> Tạo mã QR
                        </button>
                    )}
                    {request && <button type="button" onClick={createRequest} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"><RefreshCw size={14} /> Tạo QR mới</button>}
                    <p className="m-0 text-center text-xs text-slate-500">{status || 'Mã QR chỉ dùng một lần và hết hạn sau 2 phút.'}</p>
                </div>
            )}
            {mode === 'approve' && allowApprove && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500"><Camera size={15} /> Quét QR từ thiết bị mới, rồi xác nhận yêu cầu.</div>
                    <video ref={videoRef} muted playsInline className="max-h-64 w-full rounded-lg bg-slate-950 object-cover" />
                    {cameraError && <p className="m-0 text-xs text-amber-600">{cameraError}</p>}
                    <form onSubmit={submitManual} className="space-y-2">
                        <textarea value={manualPayload} onChange={event => setManualPayload(event.target.value)} rows={2} placeholder="Hoặc dán nội dung QR JSON tại đây" className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950" />
                        <button type="submit" disabled={busy || !manualPayload.trim()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Xác nhận yêu cầu</button>
                    </form>
                    {status && <p role="status" className="text-xs text-slate-500">{status}</p>}
                </div>
            )}
        </section>
    );
}
