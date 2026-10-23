import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, RefreshCw, ShieldAlert, Video } from 'lucide-react';

const CAMERA_STORAGE_KEY = 'student-manager-preferred-camera';

function stopStream(stream) {
    stream?.getTracks?.().forEach((track) => track.stop());
}

export default function CameraSettings() {
    const previewRef = useRef(null);
    const streamRef = useRef(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
        try { return localStorage.getItem(CAMERA_STORAGE_KEY) || ''; } catch { return ''; }
    });
    const [previewing, setPreviewing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const stopPreview = useCallback(() => {
        stopStream(streamRef.current);
        streamRef.current = null;
        if (previewRef.current) previewRef.current.srcObject = null;
        setPreviewing(false);
    }, []);

    const refreshDevices = useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) {
            setError('Trình duyệt này không hỗ trợ truy cập danh sách camera. Hãy dùng trình duyệt hiện đại và HTTPS hoặc localhost.');
            return;
        }
        try {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            setDevices(allDevices.filter((device) => device.kind === 'videoinput'));
            setError('');
        } catch {
            setError('Không thể đọc danh sách camera. Hãy kiểm tra quyền truy cập của trình duyệt.');
        }
    }, []);

    useEffect(() => {
        void refreshDevices();
        return () => stopStream(streamRef.current);
    }, [refreshDevices]);

    useEffect(() => {
        if (previewRef.current && streamRef.current) previewRef.current.srcObject = streamRef.current;
    }, [previewing]);

    const startPreview = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Trình duyệt không hỗ trợ camera. Hãy dùng HTTPS hoặc localhost và cập nhật trình duyệt.');
            return;
        }
        setLoading(true);
        setError('');
        setNotice('');
        try {
            stopStream(streamRef.current);
            const video = selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: 'user' };
            const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
            streamRef.current = stream;
            if (previewRef.current) {
                previewRef.current.srcObject = stream;
                await previewRef.current.play();
            }
            setPreviewing(true);
            await refreshDevices();
            setNotice('Camera đang hoạt động. Chỉ dùng để xem trước; chưa có cuộc gọi nào được bắt đầu.');
        } catch (e) {
            stopStream(streamRef.current);
            streamRef.current = null;
            setPreviewing(false);
            const messages = {
                NotAllowedError: 'Bạn đã chặn quyền camera. Hãy cho phép camera trong cài đặt quyền của trình duyệt.',
                NotFoundError: 'Không tìm thấy camera được kết nối.',
                NotReadableError: 'Camera đang được ứng dụng khác sử dụng hoặc hệ điều hành không cho phép truy cập.',
                OverconstrainedError: 'Camera đã chọn không còn khả dụng. Hãy chọn thiết bị khác.'
            };
            setError(messages[e?.name] || 'Không thể mở camera. Hãy kiểm tra kết nối thiết bị và quyền camera.');
        } finally {
            setLoading(false);
        }
    };

    const savePreferredCamera = () => {
        try {
            if (selectedDeviceId) localStorage.setItem(CAMERA_STORAGE_KEY, selectedDeviceId);
            else localStorage.removeItem(CAMERA_STORAGE_KEY);
            setNotice(selectedDeviceId ? 'Đã lưu camera mặc định cho các cuộc gọi tiếp theo trên trình duyệt này.' : 'Đã đặt camera mặc định về lựa chọn tự động.');
            setError('');
        } catch {
            setError('Không thể lưu lựa chọn trong trình duyệt. Hãy kiểm tra chế độ riêng tư hoặc dung lượng lưu trữ.');
        }
    };

    return (
        <section className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Camera size={21} aria-hidden="true" /></span>
                <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Cài đặt camera</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">Chọn thiết bị, kiểm tra hình ảnh và lưu camera mặc định. Camera chỉ bật khi bạn chủ động nhấn xem trước hoặc bắt đầu cuộc gọi.</p>
                </div>
            </div>

            <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)]">
                <div className="min-w-0">
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950">
                        <video ref={previewRef} autoPlay muted playsInline aria-label="Xem trước camera" className={`h-full w-full object-contain ${previewing ? '' : 'hidden'}`} />
                        {!previewing && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center text-slate-300"><Video size={34} aria-hidden="true" /><span className="text-sm">Camera đang tắt</span><span className="text-xs text-slate-500">Nhấn “Bật xem trước” để kiểm tra hình ảnh</span></div>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {!previewing ? (
                            <button type="button" onClick={startPreview} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"><Camera size={16} />{loading ? 'Đang mở camera…' : 'Bật xem trước'}</button>
                        ) : (
                            <button type="button" onClick={stopPreview} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><CameraOff size={16} />Tắt camera</button>
                        )}
                        <button type="button" onClick={() => void refreshDevices()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw size={16} />Làm mới thiết bị</button>
                    </div>
                </div>

                <div className="min-w-0">
                    <label htmlFor="preferred-camera" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">Camera mặc định</label>
                    <select id="preferred-camera" value={selectedDeviceId} onChange={(event) => { const nextId = event.target.value; if (previewing) { stopPreview(); setNotice('Đã đổi lựa chọn camera. Nhấn “Bật xem trước” để kiểm tra thiết bị mới.'); } setSelectedDeviceId(nextId); }} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                        <option value="">Tự động chọn camera</option>
                        {devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
                    </select>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{devices.length ? `Phát hiện ${devices.length} camera. Tên thiết bị có thể chỉ xuất hiện sau khi cấp quyền.` : 'Chưa phát hiện camera hoặc trình duyệt chưa cấp quyền để đọc tên thiết bị.'}</p>
                    <button type="button" onClick={savePreferredCamera} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-950"><CheckCircle2 size={16} />Lưu camera mặc định</button>
                    <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300"><ShieldAlert size={16} className="mt-0.5 shrink-0" /><span>Trình duyệt chỉ cho phép truy cập camera trên HTTPS hoặc localhost. Lựa chọn được lưu trên trình duyệt này, không đồng bộ sang thiết bị khác.</span></div>
                </div>
            </div>
            {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
            {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}
        </section>
    );
}
