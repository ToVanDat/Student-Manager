import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, MonitorUp } from 'lucide-react';


function AvatarCountdown({ name, avatar, progress, size = 80 }) {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const initials = String(name || 'User')
        .trim()
        .split(/\\s+/)
        .slice(0, 2)
        .map(part => part[0] || '')
        .join('')
        .toUpperCase();

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg
                className="absolute inset-0 h-full w-full -rotate-90"
                viewBox="0 0 100 100"
                aria-label={`Thời gian chờ cuộc gọi còn ${Math.max(0, Math.ceil(progress / 100 * 30))} giây`}
                role="img"
            >
                <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="5" />
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, progress)) / 100)}
                    className="transition-[stroke-dashoffset] duration-100"
                />
            </svg>
            <div
                className="absolute overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                style={{ inset: size * 0.12 }}
            >
                {avatar ? (
                    <img src={avatar} alt={name || 'Avatar'} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-slate-600 dark:text-slate-200">
                        {initials || 'U'}
                    </div>
                )}
            </div>
        </div>
    );
}


export default function CallPanel({
    targetUsername,
    state,
    call,
    localStream,
    remoteStream,
    muted,
    cameraOn,
    sharingScreen,
    callDurationSeconds = 0,
    error,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare
}) {

    const remoteAudioRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const [ringRemainingMs, setRingRemainingMs] = useState(30_000);
    const [showNotice, setShowNotice] = useState(false);

    useEffect(() => {
        if (state !== 'calling' || !call?.ringStartedAt) {
            setRingRemainingMs(30_000);
            return undefined;
        }

        const timeoutMs = Number(call.ringTimeoutMs) || 30_000;
        const updateCountdown = () => {
            setRingRemainingMs(Math.max(0, call.ringStartedAt + timeoutMs - Date.now()));
        };
        updateCountdown();
        const timer = setInterval(updateCountdown, 100);
        return () => clearInterval(timer);
    }, [state, call?.callId, call?.ringStartedAt, call?.ringTimeoutMs]);

    useEffect(() => {
        if (!error) {
            setShowNotice(false);
            return undefined;
        }
        setShowNotice(true);
        const timer = setTimeout(() => setShowNotice(false), 6500);
        return () => clearTimeout(timer);
    }, [error]);

    const ringProgress = call?.ringTimeoutMs
        ? Math.max(0, Math.min(100, (ringRemainingMs / call.ringTimeoutMs) * 100))
        : 100;
    const ringSecondsLeft = Math.ceil(ringRemainingMs / 1000);

    useEffect(() => {
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream || null;
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream || null;
        }

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream || null;
        }
    }, [localStream, remoteStream]);

    const displayName =
        call?.remoteUsername ||
        targetUsername ||
        'User';

    const formattedCallDuration = (() => {
        const total = Math.max(Number(callDurationSeconds) || 0, 0);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        return hours > 0
            ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    })();

    const isActiveCall =
        state === 'calling' ||
        state === 'connecting' ||
        state === 'reconnecting' ||
        state === 'connected';

    return (
        <>
            {state === 'idle' && error && showNotice && (
                <div
                    role="status"
                    className="fixed left-1/2 top-5 z-[250] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                    {error}
                </div>
            )}

            {state === 'incoming' && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
                    <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="text-center">
                            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl dark:bg-blue-950/50">
                                {call?.callType === 'video' ? '📹' : '📞'}
                            </div>

                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                Cuộc gọi đến
                            </p>

                            <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                                {displayName}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {call?.callType === 'video'
                                    ? 'Đang gọi video cho bạn'
                                    : 'Đang gọi thoại cho bạn'}
                            </p>
                        </div>

                        {error && (
                            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                                {error}
                            </p>
                        )}

                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={rejectCall}
                                className="rounded-xl bg-red-600 px-4 py-3 font-medium text-white transition hover:bg-red-700"
                            >
                                Từ chối
                            </button>

                            <button
                                type="button"
                                onClick={acceptCall}
                                className="rounded-xl bg-green-600 px-4 py-3 font-medium text-white transition hover:bg-green-700"
                            >
                                Chấp nhận
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {isActiveCall && (
                <div className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-950/70 p-4">
                    <section className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-white">
                            <div>
                                <h2 className="font-semibold">
                                    {call?.callType === 'video' ? 'Video Call' : 'Voice Call'}
                                </h2>
                                <p className="text-xs text-slate-400">
                                    {displayName} · {
                                        state === 'calling'
                                            ? 'Đang gọi...'
                                            : state === 'connecting'
                                                ? 'Đang kết nối...'
                                                : state === 'reconnecting'
                                                    ? 'Đang khôi phục kết nối...'
                                                    : 'Đã kết nối'
                                    }
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                                    {state === 'calling' ? 'Đang gọi' : state === 'connecting' ? 'Đang kết nối' : state === 'reconnecting' ? 'Đang khôi phục' : 'Đã kết nối'}
                                </span>
                                {['connected', 'reconnecting'].includes(state) && (
                                    <span
                                        className="font-mono text-sm font-semibold tabular-nums text-emerald-400"
                                        aria-label="Thời lượng cuộc gọi"
                                    >
                                        {formattedCallDuration}
                                    </span>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="mx-4 mt-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        {call?.callType === 'video' ? (
                            <div className="relative aspect-video bg-black">
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="h-full w-full object-contain"
                                />

                                <div className="absolute bottom-3 right-3 h-28 w-44 overflow-hidden rounded-xl border border-white/20 bg-slate-900 shadow-lg">
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className="h-full w-full object-cover"
                                    />
                                </div>

                                {state !== 'connected' && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35 text-sm text-slate-200">
                                        {state === 'calling' && (
                                            <AvatarCountdown
                                                name={displayName}
                                                avatar={call?.remoteAvatar}
                                                progress={ringProgress}
                                                size={96}
                                            />
                                        )}
                                        <span>
                                            {state === 'calling'
                                                ? `Đang chờ người nhận · ${ringSecondsLeft}s`
                                                : state === 'reconnecting'
                                                    ? 'Đang khôi phục kết nối...'
                                                    : 'Đang thiết lập kết nối...'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex min-h-64 flex-col items-center justify-center bg-slate-950 text-white">
                                {state === 'calling' ? (
                                    <AvatarCountdown
                                        name={displayName}
                                        avatar={call?.remoteAvatar}
                                        progress={ringProgress}
                                        size={96}
                                    />
                                ) : (
                                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-3xl">
                                        📞
                                    </div>
                                )}
                                <p className="font-medium">{displayName}</p>
                                <p className="mt-1 text-sm text-slate-400">
                                    {state === 'calling'
                                        ? `Đang đổ chuông · ${ringSecondsLeft}s`
                                        : state === 'connecting'
                                            ? 'Đang kết nối...'
                                            : state === 'reconnecting'
                                                ? 'Đang khôi phục kết nối...'
                                                : 'Cuộc gọi đang diễn ra'}
                                </p>
                                <audio ref={remoteAudioRef} autoPlay />
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-3 border-t border-slate-800 bg-slate-950 px-4 py-4">
                            <button
                                type="button"
                                onClick={toggleMute}
                                aria-label={muted ? 'Bật microphone' : 'Tắt microphone'}
                                title={muted ? 'Bật microphone' : 'Tắt microphone'}
                                className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition ${muted ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-700'}`}
                            >
                                {muted ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>

                            {call?.callType === 'video' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={toggleCamera}
                                        aria-label={cameraOn ? 'Tắt camera' : 'Bật camera'}
                                        title={cameraOn ? 'Tắt camera' : 'Bật camera'}
                                        className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition ${cameraOn ? 'bg-slate-800 hover:bg-slate-700' : 'bg-red-600 hover:bg-red-700'}`}
                                    >
                                        {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={toggleScreenShare}
                                        aria-label={sharingScreen ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
                                        title={sharingScreen ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
                                        className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition ${sharingScreen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-700'}`}
                                    >
                                        <MonitorUp size={18} />
                                    </button>
                                </>
                            )}

                            <button
                                type="button"
                                onClick={endCall}
                                aria-label="Kết thúc cuộc gọi"
                                title="Kết thúc cuộc gọi"
                                className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
                            >
                                <PhoneOff size={18} />
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}
