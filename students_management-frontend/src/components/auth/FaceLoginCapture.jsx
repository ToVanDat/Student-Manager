import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import {
    beginFaceLoginApi,
    captureFaceLoginFrameApi,
    finishFaceLoginApi,
} from '@/api/authApi.js';

const FRAME_COUNT = 6;
const FRAME_INTERVAL_MS = 350;

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

const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

export default function FaceLoginCapture({ username, onClose, onSuccess }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const cancelledRef = useRef(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [instruction, setInstruction] = useState('Camera chỉ bật sau khi bạn chọn bắt đầu.');
    const [error, setError] = useState('');

    const stopCamera = () => {
        cancelledRef.current = true;
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraActive(false);
    };

    useEffect(() => () => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }, []);

    const startCapture = async () => {
        cancelledRef.current = false;
        setBusy(true);
        setError('');
        setProgress(0);
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
            await new Promise(resolve => window.requestAnimationFrame(resolve));
            if (!videoRef.current) throw new Error('Không thể khởi tạo khung xem camera.');
            videoRef.current.srcObject = stream;
            await videoRef.current.play();

            const challenge = await beginFaceLoginApi(username);
            const actions = Array.isArray(challenge.actions) ? challenge.actions : [];
            setInstruction(`Thực hiện lần lượt: ${actionText}. Giữ khuôn mặt ở giữa khung hình.`);
            await wait(900);

            for (let index = 0; index < FRAME_COUNT; index += 1) {
                if (cancelledRef.current) throw new Error('Bạn đã dừng quá trình xác minh.');
                const frame = await captureJpeg(videoRef.current);
                const result = await captureFaceLoginFrameApi(
                    challenge.challengeId,
                    challenge.livenessNonce,
                    frame,
                );
                setProgress(Math.min(FRAME_COUNT, result.frameCount || index + 1));
                if (cancelledRef.current) throw new Error('Bạn đã dừng quá trình xác minh.');
                if (index < FRAME_COUNT - 1) await wait(FRAME_INTERVAL_MS);
            }

            setInstruction('Đang xác minh khuôn mặt và kiểm tra PAD…');
            sessionStorage.setItem('auth:login-in-progress', 'true');
            const data = await finishFaceLoginApi(challenge.challengeId);
            stopCamera();
            onSuccess(data);
        } catch (requestError) {
            if (!cancelledRef.current) {
                setError(requestError.response?.data?.message || requestError.message || 'Đăng nhập bằng Face Login thất bại.');
            }
            stopCamera();
        } finally {
            sessionStorage.removeItem('auth:login-in-progress');
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="face-login-title">
            <section className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                    <div>
                        <h2 id="face-login-title" className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">Đăng nhập bằng Face Login</h2>
                        <p className="mb-0 mt-1 text-xs text-slate-500">Tài khoản: {username}</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"><X size={18} /></button>
                </header>
                <div className="p-5">
                    {cameraActive ? (
                        <div className="overflow-hidden rounded-xl bg-slate-950">
                            <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
                            <div className="flex items-center justify-between px-3 py-2 text-xs text-white">
                                <span className="inline-flex items-center gap-2"><Camera size={14} /> Đang thu thập frame</span>
                                <span>{progress}/{FRAME_COUNT}</span>
                            </div>
                            <div className="h-1 bg-slate-700"><div className="h-1 bg-indigo-400 transition-all" style={{ width: `${progress / FRAME_COUNT * 100}%` }} /></div>
                        </div>
                    ) : (
                        <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                            <CameraOff size={34} />
                        </div>
                    )}
                    <p className="mb-0 mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{instruction}</p>
                    <p className="mb-0 mt-2 text-xs leading-5 text-slate-500">Ảnh được gửi tới máy chủ để xử lý PAD và nhận diện. Hệ thống không nhận embedding hoặc điểm liveness do trình duyệt tự tạo.</p>
                    {error && <p role="alert" className="mb-0 mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
                    <div className="mt-4 flex gap-2">
                        {!cameraActive && <button type="button" onClick={startCapture} disabled={busy} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Camera size={16} />}
                            {error ? 'Thử lại' : 'Bắt đầu xác minh'}
                        </button>}
                        {cameraActive && <button type="button" onClick={stopCamera} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
                            <CameraOff size={16} /> Dừng camera
                        </button>}
                        <button type="button" onClick={onClose} disabled={busy} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Hủy</button>
                    </div>
                    {progress === FRAME_COUNT && <p className="mb-0 mt-3 inline-flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={14} /> Đã gửi đủ frame, đang chờ xác minh.</p>}
                </div>
            </section>
        </div>
    );
}
