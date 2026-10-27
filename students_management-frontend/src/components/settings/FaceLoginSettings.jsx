import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ShieldCheck, ShieldAlert, Trash2, Video, VideoOff } from 'lucide-react';
import {
    beginFaceEnrollmentApi,
    captureFaceEnrollmentFrameApi,
    disableFaceLoginApi,
    finishFaceEnrollmentApi,
    getFaceLoginStatusApi,
} from '@/api/authApi.js';

const FRAME_COUNT = 8;
const FRAME_INTERVAL_MS = 350;

function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

function captureJpeg(video) {
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
        throw new Error('Camera chưa sẵn sàng. Hãy giữ khuôn mặt trong khung hình.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Không thể khởi tạo bộ xử lý camera.');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Không thể tạo frame camera.'));
        }, 'image/jpeg', 0.82);
    });
}

export default function FaceLoginSettings() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [cameraActive, setCameraActive] = useState(false);
    const [progress, setProgress] = useState(0);
    const [instruction, setInstruction] = useState('');
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const mountedRef = useRef(true);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        if (mountedRef.current) setCameraActive(false);
    }, []);

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

    useEffect(() => {
        mountedRef.current = true;
        void refresh();
        return () => {
            mountedRef.current = false;
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        };
    }, [refresh]);

    const enroll = async () => {
        const currentPassword = window.prompt('Nhập mật khẩu Student Manager để xác nhận đăng ký khuôn mặt:');
        if (!currentPassword) return;
        setBusy(true);
        setError('');
        setProgress(0);
        setInstruction('');
        let stream;
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Trình duyệt không hỗ trợ camera hoặc trang hiện tại chưa chạy trên HTTPS/localhost.');
            }
            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            });
            streamRef.current = stream;
            setCameraActive(true);
            // Wait for React to mount the conditional video element before binding the stream.
            await new Promise(resolve => window.requestAnimationFrame(resolve));
            if (!videoRef.current) throw new Error('Không thể khởi tạo khung xem camera.');
            videoRef.current.srcObject = stream;
            await videoRef.current.play();

            const challenge = await beginFaceEnrollmentApi(null, currentPassword);
            const actions = Array.isArray(challenge.actions) ? challenge.actions : [];
            const actionText = actions.map(action => action === 'blink' ? 'chớp mắt' : 'mỉm cười').join(' → ');
            setInstruction(`Thực hiện lần lượt: ${actionText}. Giữ khuôn mặt ở giữa khung hình.`);
            await wait(900);

            for (let index = 0; index < FRAME_COUNT; index += 1) {
                const frame = await captureJpeg(videoRef.current);
                const result = await captureFaceEnrollmentFrameApi(
                    challenge.challengeId,
                    challenge.livenessNonce,
                    frame,
                );
                setProgress(Math.min(FRAME_COUNT, result.frameCount || index + 1));
                if (index < FRAME_COUNT - 1) await wait(FRAME_INTERVAL_MS);
            }

            await finishFaceEnrollmentApi(challenge.challengeId);
            setInstruction('Đăng ký khuôn mặt đã hoàn tất.');
            await refresh();
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Không thể đăng ký khuôn mặt.');
        } finally {
            stream?.getTracks().forEach(track => track.stop());
            if (streamRef.current === stream) streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
            setCameraActive(false);
            setBusy(false);
        }
    };

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
                Face Login là phương thức riêng của Student Manager, không thay thế Passkey/Face ID của hệ điều hành.
                Camera chỉ được bật khi bạn chủ động đăng ký. Frame được gửi tới server để kiểm tra PAD và liveness; không lưu ảnh thô vào cơ sở dữ liệu.
            </p>
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                <span>
                    {available
                        ? 'Pipeline server đã sẵn sàng. Việc đăng ký vẫn yêu cầu xác minh lại tài khoản.'
                        : 'Face Login đang khóa an toàn: cần bật release gate sau khi cài đúng ONNX Runtime, xác minh model, kiểm thử camera thực và hiệu chuẩn PAD/face-match. Không chấp nhận embedding hoặc điểm liveness do trình duyệt tự gửi.'}
                </span>
            </div>
            {cameraActive && (
                <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-700">
                    <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
                    <div className="flex items-center justify-between gap-3 p-3 text-xs text-white">
                        <span className="inline-flex items-center gap-2"><Video size={14} /> Đang ghi nhận frame an toàn</span>
                        <span>{progress}/{FRAME_COUNT}</span>
                    </div>
                    <div className="h-1 bg-slate-700"><div className="h-1 bg-indigo-400 transition-all" style={{ width: `${progress / FRAME_COUNT * 100}%` }} /></div>
                </div>
            )}
            {instruction && <p className="mb-3 text-xs font-medium text-indigo-700 dark:text-indigo-300">{instruction}</p>}
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy || loading || !available || configured} onClick={enroll}
                    title={!available ? 'Đang chờ kiểm định pipeline server' : configured ? 'Tài khoản đã có face credential' : 'Đăng ký khuôn mặt'}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
                    {busy ? <Video size={15} /> : <Camera size={15} />}
                    {busy ? 'Đang xử lý…' : 'Đăng ký khuôn mặt'}
                </button>
                {configured && <button type="button" disabled={busy || loading} onClick={disable}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">
                    <Trash2 size={14} /> Vô hiệu hóa
                </button>}
                {cameraActive && <button type="button" disabled={!busy} onClick={stopCamera}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
                    <VideoOff size={14} /> Dừng camera
                </button>}
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><ShieldCheck size={13} /> Challenge một lần · AES-256-GCM</span>
            </div>
            {status?.credential?.enrolledAt && <p className="mb-0 mt-3 text-[11px] text-slate-400">Đăng ký: {new Date(status.credential.enrolledAt).toLocaleString()}</p>}
            {error && <p role="alert" className="mb-0 mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        </section>
    );
}
