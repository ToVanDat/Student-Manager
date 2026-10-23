import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, MonitorUp, PhoneIncoming, RefreshCw, Volume2 } from 'lucide-react';
import AvatarFallback from '@/components/chat/AvatarFallback.jsx';
import { resolveMediaUrl } from '@/utils/mediaUrl.js';
import { playSound, stopSound } from '@/services/soundService.js';
import { useLanguage } from '@/context/LanguageContext.jsx';


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
    const [imageError, setImageError] = useState(false);
    const resolvedAvatar = resolveMediaUrl(avatar);

    useEffect(() => setImageError(false), [avatar]);

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
                    className="transition-[stroke-dashoffset] duration-100 motion-reduce:transition-none"
                />
            </svg>
            <div
                className="absolute overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                style={{ inset: size * 0.12 }}
            >
                {resolvedAvatar && !imageError ? (
                    <img src={resolvedAvatar} alt={name || 'Avatar'} onError={() => setImageError(true)} className="h-full w-full object-cover" />
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
    toggleScreenShare,
    retryCall,
    dismissCall
}) {
    const { t } = useLanguage();

    const remoteAudioRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const [ringRemainingMs, setRingRemainingMs] = useState(30_000);
    const [showNotice, setShowNotice] = useState(false);
    const [incomingActionBusy, setIncomingActionBusy] = useState(false);\n    const [remoteVolume, setRemoteVolume] = useState(0.8);

    const previousCallStateRef = useRef('idle');
    const lastEndedCallIdRef = useRef(null);

    useEffect(() => {
        if (state === 'incoming') {
            stopSound('outgoingCall');
            void playSound('incomingCall', { volume: 0.65, loop: true });
        } else if (state === 'calling') {
            stopSound('incomingCall');
            void playSound('outgoingCall', { volume: 0.5, loop: true });
        } else {
            stopSound('incomingCall');
            stopSound('outgoingCall');
            if (state === 'failed') {
                void playSound('callError', { volume: 0.55, durationMs: 900 });
            } else if (state === 'idle' && previousCallStateRef.current !== 'idle' && previousCallStateRef.current !== 'failed') {
                const isBusy = /bận|busy|từ chối|rejected/i.test(error || '');
                const callId = call?.callId || null;
                if (!callId || lastEndedCallIdRef.current !== callId) {
                    lastEndedCallIdRef.current = callId;
                    void playSound(isBusy ? 'callBusy' : 'callEnded', { volume: 0.55, durationMs: 900 });
                }
            }
        }
        previousCallStateRef.current = state;
    }, [state, call?.callId, error]);

    useEffect(() => () => {
        stopSound('incomingCall');
        stopSound('outgoingCall');
    }, []);

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

    useEffect(() => {
        const volume = Math.max(0, Math.min(1, remoteVolume));
        if (remoteAudioRef.current) remoteAudioRef.current.volume = volume;
        if (remoteVideoRef.current) remoteVideoRef.current.volume = volume;
    }, [remoteVolume, localStream, remoteStream]);

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
        state === 'connected' ||
        state === 'failed';

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
                <div className="call-overlay call-overlay--incoming fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-200/65 p-4 backdrop-blur-md sm:p-6">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="incoming-call-title"
                        aria-describedby="incoming-call-description"
                        className="call-dialog call-dialog--incoming my-auto w-full max-w-[390px] rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_24px_80px_rgba(2,6,23,.3)] dark:border-slate-700 dark:bg-slate-900 sm:p-8"
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
                                {call?.callType === 'video' ? t('videoCallingYou') : t('voiceCallingYou')}
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
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
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
                <div className={`call-overlay call-overlay--active ${call?.callType === 'video' ? 'call-overlay--video' : 'call-overlay--audio'} fixed inset-0 z-[190] flex items-center justify-center overflow-y-auto bg-slate-200/70 p-2 backdrop-blur-sm sm:p-4`}>
                    <section className={`call-dialog call-dialog--active my-auto flex max-h-[calc(100dvh-1rem)] w-full ${call?.callType === 'video' ? 'max-w-6xl' : 'max-w-4xl'} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] dark:border-slate-700 dark:bg-slate-900`}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-slate-900 dark:border-slate-800 dark:text-white">
                            <div>
                                <h2 className="font-semibold">
                                    {call?.callType === 'video' ? t('videoCall') : t('voiceCall')}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {displayName} · {
                                        state === 'calling'
                                            ? t('calling')
                                            : state === 'connecting'
                                                ? t('connecting')
                                                : state === 'reconnecting'
                                                    ? t('reconnecting')
                                                    : t('connected')
                                    }
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {state === 'calling' ? t('calling') : state === 'connecting' ? t('connecting') : state === 'reconnecting' ? t('reconnecting') : state === 'failed' ? t('failed') : t('connected')}
                                </span>
                                {['connected', 'reconnecting'].includes(state) && (
                                    <span
                                        className="font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
                                        aria-label="Thời lượng cuộc gọi"
                                    >
                                        {formattedCallDuration}
                                    </span>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="mx-4 mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                                {error}
                            </div>
                        )}

                        {state === 'failed' ? (
                            <div className="flex min-h-64 flex-col items-center justify-center gap-3 bg-white px-6 py-8 text-center text-slate-900 dark:bg-slate-900 dark:text-white">
                                <AvatarFallback name={displayName} src={call?.remoteAvatar} size="xl" className="[&>img]:h-24 [&>img]:w-24 [&>div]:h-24 [&>div]:w-24" />
                                <h3 className="mt-2 text-lg font-semibold">{t('callConnectionFailed')}</h3>
                                <p role="alert" className="max-w-md text-sm text-slate-600 dark:text-slate-300">{error || t('callNotEstablished')}</p>
                                <p className="text-xs text-slate-500">Kiểm tra kết nối mạng và quyền microphone/camera rồi thử lại.</p>
                            </div>
                        ) : call?.callType === 'video' ? (
                            <div className="call-video-stage relative aspect-video min-h-0 bg-slate-100 dark:bg-black">
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="h-full w-full object-contain"
                                />

                                <div className="call-local-video absolute bottom-3 right-3 h-28 w-44 overflow-hidden rounded-xl border border-white/20 bg-slate-900 shadow-lg">
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className="h-full w-full object-cover"
                                    />
                                </div>

                                {(!hasRemoteVideo || state !== 'connected') && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100/90 px-4 text-sm text-slate-700 dark:bg-black/55 dark:text-slate-200">
                                        {(!hasRemoteVideo || state === 'calling') && (
                                            state === 'calling'
                                                ? <AvatarCountdown name={displayName} avatar={call?.remoteAvatar} progress={ringProgress} size={96} />
                                                : <AvatarFallback name={displayName} src={call?.remoteAvatar} size="xl" className="[&>img]:h-24 [&>img]:w-24 [&>div]:h-24 [&>div]:w-24" />
                                        )}
                                        <span>
                                            {state === 'calling'
                                                ? `Đang chờ người nhận · ${ringSecondsLeft}s`
                                                : state === 'reconnecting'
                                                    ? t('reconnecting')
                                                    : !hasRemoteVideo
                                                        ? 'Đang chờ video hoặc camera đang tắt'
                                                        : 'Đang thiết lập kết nối...'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="call-audio-stage flex min-h-64 flex-col items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
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
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {state === 'calling'
                                        ? `Đang đổ chuông · ${ringSecondsLeft}s`
                                        : state === 'connecting'
                                            ? t('connecting')
                                            : state === 'reconnecting'
                                                ? t('reconnecting')
                                                : 'Cuộc gọi đang diễn ra'}
                                </p>
                                <audio ref={remoteAudioRef} autoPlay />
                            </div>
                        )}

                        <div className="call-controls flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-slate-100 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900">
                            {state === 'failed' ? (
                                <>
                                    <button type="button" onClick={retryCall} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
                                        <RefreshCw size={17} aria-hidden="true" /> Thử lại
                                    </button>
                                    <button type="button" onClick={dismissCall} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400">
                                        <PhoneOff size={17} aria-hidden="true" /> Kết thúc
                                    </button>
                                </>
                            ) : (
                                <>
                            <button
                                type="button"
                                onClick={toggleMute}
                                aria-label={muted ? t('enableMicrophone') : t('disableMicrophone')}
                                title={muted ? t('enableMicrophone') : t('disableMicrophone')}
                                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${muted ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                {muted ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>

                            {call?.callType === 'video' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={toggleCamera}
                                        aria-label={cameraOn ? t('turnCameraOff') : t('turnCameraOn')}
                                        title={cameraOn ? t('turnCameraOff') : t('turnCameraOn')}
                                        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${cameraOn ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                                    >
                                        {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={toggleScreenShare}
                                        aria-label={sharingScreen ? t('stopScreenSharing') : t('shareScreen')}
                                        title={sharingScreen ? t('stopScreenSharing') : t('shareScreen')}
                                        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${sharingScreen ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'}`}
                                    >
                                        <MonitorUp size={18} />
                                    </button>
                                </>
                            )}

                            <div className="flex min-h-11 items-center gap-2 rounded-full bg-slate-100 px-3 text-slate-700 dark:bg-slate-800 dark:text-slate-100" title="Âm lượng người nghe">
                                <Volume2 size={17} aria-hidden="true" />
                                <label htmlFor="call-remote-volume" className="sr-only">Âm lượng cuộc gọi</label>
                                <input
                                    id="call-remote-volume"
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={Math.round(remoteVolume * 100)}
                                    onChange={(event) => setRemoteVolume(Number(event.target.value) / 100)}
                                    aria-label="Điều chỉnh âm lượng người nghe"
                                    className="w-20 cursor-pointer accent-blue-600 sm:w-28"
                                />
                                <span className="w-8 text-right text-xs tabular-nums">{Math.round(remoteVolume * 100)}%</span>
                            </div>

                            <button
                                type="button"
                                onClick={endCall}
                                aria-label={t("endCall")}
                                title={t("endCall")}
                                className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
                            >
                                <PhoneOff size={18} />
                            </button>
                                </>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}
