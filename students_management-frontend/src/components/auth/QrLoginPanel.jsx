import { useEffect, useRef, useState } from 'react';
import { QrCode, Camera, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { approveQrLoginApi, cancelQrLoginApi, createQrLoginApi, pollQrLoginApi } from '@/api/authApi.js';

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
    const [scannerEnabled, setScannerEnabled] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const frameRef = useRef(null);

    const createRequest = async () => {
        setBusy(true);
        setStatus('');
        try {
            if (request) {
                try { await cancelQrLoginApi(request.requestId, request.secret); } catch {}
            }
            const result = await createQrLoginApi();
            setRequest(result);
            setStatus('Đang chờ xác nhận trên thiết bị đã đăng nhập.');
        } catch (error) {
            setStatus(error.response?.data?.message || 'Không tạo được yêu cầu QR.');
        } finally { setBusy(false); }
    };

    const cancelRequest = async () => {
        if (!request) return;
        setBusy(true);
        try {
            await cancelQrLoginApi(request.requestId, request.secret);
            setRequest(null);
            setStatus('Đã hủy yêu cầu đăng nhập QR.');
        } catch (error) {
            setStatus(error.response?.data?.message || 'Không thể hủy yêu cầu QR.');
        } finally { setBusy(false); }
    };

    useEffect(() => {
        if (mode !== 'login' || !request) return undefined;
        let active = true;
        let polling = false;
        const poll = async () => {
            // Prevent overlapping polls and keep the session-replacement guard
            // active for the request that may consume the QR and issue a session.
            if (!active || polling) return;
            polling = true;
            sessionStorage.setItem('auth:login-in-progress', 'true');
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
            } finally {
                sessionStorage.removeItem('auth:login-in-progress');
                polling = false;
            }
        };
        const timer = window.setInterval(poll, 2000);
        void poll();
        return () => { active = false; window.clearInterval(timer); };
    }, [mode, request, onLogin]);

    useEffect(() => {
        if (mode !== 'approve' || !allowApprove || !scannerEnabled || !videoRef.current) return undefined;
        let active = true;
        const scan = async () => {
            if (!active || !videoRef.current) return;
            try {
                if (!('BarcodeDetector' in window)) {
                    setCameraError('Trình duyệt này chưa hỗ trợ quét QR trực tiếp. Hãy dán nội dung QR vào ô bên dưới.');
                    setScannerEnabled(false);
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
                if (active) { setCameraError('Không thể đọc QR. Hãy kiểm tra quyền camera hoặc nhập thủ công.'); setScannerEnabled(false); }
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
            .catch(() => { setCameraError('Không truy cập được camera. Hãy cho phép quyền camera hoặc nhập thủ công.'); setScannerEnabled(false); });
        return () => {
            active = false;
            if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
            (stream || streamRef.current)?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        };
    }, [mode, allowApprove, scannerEnabled]);

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
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Đăng nhập bằng mã QR">
            <div className="mb-4 flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <QrCode size={20} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <h3 className="m-0 text-sm font-bold text-slate-900">Đăng nhập bằng mã QR</h3>
                    <p className="mt-1 mb-0 text-xs leading-5 text-slate-500">
                        Dùng điện thoại đã đăng nhập Student Manager để quét và xác nhận.
                    </p>
                </div>
            </div>

            {allowApprove && !approvalOnly && (
                <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                    <button type="button" onClick={() => { setMode('login'); setScannerEnabled(false); setCameraError(''); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Hiển thị QR</button>
                    <button type="button" onClick={() => { setMode('approve'); setScannerEnabled(false); setCameraError(''); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${mode === 'approve' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Quét để xác nhận</button>
                </div>
            )}

            {mode === 'login' && !approvalOnly && (
                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                        <ol className="space-y-2 text-xs leading-5 text-slate-600">
                            <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">1</span><span>Tạo mã QR trên máy tính.</span></li>
                            <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">2</span><span>Mở Student Manager trên điện thoại đã đăng nhập và quét mã.</span></li>
                            <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">3</span><span>Kiểm tra yêu cầu rồi nhấn xác nhận trên điện thoại.</span></li>
                        </ol>
                    </div>

                    <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                        {request ? (
                            <>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <QRCodeSVG value={qrValue} size={196} level="M" includeMargin />
                                </div>
                                <p className="m-0 text-center text-xs font-medium text-slate-600">Đang chờ xác nhận từ điện thoại</p>
                            </>
                        ) : (
                            <>
                                <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                                    <QrCode size={27} aria-hidden="true" />
                                </div>
                                <p className="m-0 max-w-[240px] text-center text-xs leading-5 text-slate-500">Mã QR chỉ được tạo khi bạn yêu cầu và có thời hạn sử dụng.</p>
                                <button type="button" onClick={createRequest} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                    <QrCode size={16} aria-hidden="true" /> {busy ? 'Đang tạo mã…' : 'Tạo mã QR'}
                                </button>
                            </>
                        )}
                    </div>

                    {request && (
                        <div className="flex flex-wrap justify-center gap-2">
                            <button type="button" onClick={cancelRequest} disabled={busy} className="flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-50">Hủy yêu cầu</button>
                            <button type="button" onClick={createRequest} disabled={busy} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-50">
                                <RefreshCw size={14} aria-hidden="true" /> Tạo mã QR mới
                            </button>
                        </div>
                    )}
                    <p role="status" aria-live="polite" className="m-0 text-center text-xs leading-5 text-slate-500">
                        {status || 'Không chia sẻ ảnh QR với người khác. QR hết hạn sau 2 phút hoặc khi được sử dụng.'}
                    </p>
                </div>
            )}

            {mode === 'approve' && allowApprove && (
                <div className="space-y-3">
                    <div className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                        Quét mã trên máy tính chỉ khi bạn tự yêu cầu đăng nhập. Kiểm tra yêu cầu trước khi cho phép.
                    </div>
                    {scannerEnabled ? (
                        <video ref={videoRef} muted playsInline className="max-h-64 min-h-44 w-full rounded-xl bg-slate-950 object-cover" />
                    ) : (
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                            <Camera size={24} className="text-slate-500" aria-hidden="true" />
                            <p className="m-0 text-xs leading-5 text-slate-600">Camera chỉ bật khi bạn chủ động chọn quét QR. Bạn cũng có thể dán nội dung QR bên dưới.</p>
                            <button type="button" onClick={() => { setCameraError(''); setScannerEnabled(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"><Camera size={15} /> Quét QR để xác nhận</button>
                        </div>
                    )}
                    {cameraError && <p role="status" className="m-0 text-xs leading-5 text-amber-700">{cameraError}</p>}
                    <form onSubmit={submitManual} className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700" htmlFor="qr-login-manual-payload">Nhập nội dung QR thủ công</label>
                        <textarea id="qr-login-manual-payload" value={manualPayload} onChange={event => setManualPayload(event.target.value)} rows={2} placeholder="Dán nội dung QR nếu camera không hoạt động" className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                        <button type="submit" disabled={busy || !manualPayload.trim()} className="min-h-10 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Đang xác nhận…' : 'Xác nhận yêu cầu'}</button>
                    </form>
                    {status && <p role="status" aria-live="polite" className="m-0 text-xs leading-5 text-slate-600">{status}</p>}
                </div>
            )}
        </section>
    );
}
