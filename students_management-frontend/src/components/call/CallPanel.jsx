import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, MonitorUp, PhoneIncoming } from 'lucide-react';
import AvatarFallback from '@/components/chat/AvatarFallback.jsx';


function AvatarCountdown({ name, avatar, progress, size = 80 }) {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const initials = String(name || 'User')
        .trim()
        .split(/\s+/)
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
    const [incomingActionBusy, setIncomingActionBusy] = useState(false);

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
    const hasRemoteVideo = Boolean(remoteStream?.getVideoTracks?.().some(track => track.readyState === 'live' && track.enabled));

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
                <div className="call-overlay fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-md sm:p-6">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="incoming-call-title"
                        aria-describedby="incoming-call-description"
                        className="call-dialog my-auto w-full max-w-[390px] rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_24px_80px_rgba(2,6,23,.3)] dark:border-slate-700 dark:bg-slate-900 sm:p-8"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="mb-5 rounded-full bg-blue-50 p-1.5 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900">
                                <AvatarFallback name={displayName} src={call?.remoteAvatar} size="xl" className="[&>img]:h-24 [&>img]:w-24 [&>div]:h-24 [&>div]:w-24" />
                            </div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" />
                                Cuộc gọi đến
                            </span>
                            <h2 id="incoming-call-title" className="mt-4 max-w-full break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                {displayName}
                            </h2>
                            <p id="incoming-call-description" className="mt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                {call?.callType === 'video' ? <Video size={17} aria-hidden="true" /> : <Phone size={17} aria-hidden="true" />}
                                {call?.callType === 'video' ? 'Đang gọi video cho bạn' : 'Đang gọi thoại cho bạn'}
                            </p>
                        </div>

                        {error && (
                            <p role="alert" className="mt-5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                {error}
                            </p>
                        )}

                        <div className="mt-8 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={async () => { if (incomingActionBusy) return; setIncomingActionBusy(true); try { await rejectCall(); } finally { setIncomingActionBusy(false); } }}
                                disabled={incomingActionBusy}
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/40"
                            >
                                <PhoneOff size={18} aria-hidden="true" />
                                Từ chối
                            </button>
                            <button
                                type="button"
                                onClick={async () => { if (incomingActionBusy) return; setIncomingActionBusy(true); try { await acceptCall(); } finally { setIncomingActionBusy(false); } }}
                                disabled={incomingActionBusy}
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <PhoneIncoming size={18} aria-hidden="true" />
                                Chấp nhận
                            </button>
                        </div>
                        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">Bạn có thể chấp nhận hoặc từ chối cuộc gọi này.</p>
                    </section>
                </div>
            )}

            {isActiveCall && (
                <div className="call-overlay fixed inset-0 z-[190] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-2 backdrop-blur-sm sm:p-4">
                    <section className="my-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
                        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-white">
                            <div>
                                <h2 className="font-semibold">
                                    {call?.callType === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}
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
                            <div className="relative aspect-video min-h-0 bg-black">
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

                                {(!hasRemoteVideo || state !== 'connected') && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 px-4 text-sm text-slate-200">
                                        {(!hasRemoteVideo || state === 'calling') && (
                                            state === 'calling'
                                                ? <AvatarCountdown name={displayName} avatar={call?.remoteAvatar} progress={ringProgress} size={96} />
                                                : <AvatarFallback name={displayName} src={call?.remoteAvatar} size="xl" className="[&>img]:h-24 [&>img]:w-24 [&>div]:h-24 [&>div]:w-24" />
                                        )}
                                        <span>
                                            {state === 'calling'
                                                ? `Đang chờ người nhận · ${ringSecondsLeft}s`
                                                : state === 'reconnecting'
                                                    ? 'Đang khôi phục kết nối...'
                                                    : !hasRemoteVideo
                                                        ? 'Đang chờ video hoặc camera đang tắt'
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
                                    <AvatarFallback name={displayName} src={call?.remoteAvatar} size="xl" className="mb-4 [&>img]:h-24 [&>img]:w-24 [&>div]:h-24 [&>div]:w-24" />
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

                        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-slate-800 bg-slate-950 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
