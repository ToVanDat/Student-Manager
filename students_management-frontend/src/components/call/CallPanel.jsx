import { useEffect, useRef } from 'react';

export default function CallPanel({
    targetUsername,
    state,
    call,
    localStream,
    remoteStream,
    muted,
    cameraOn,
    sharingScreen,
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

    const isActiveCall =
        state === 'calling' ||
        state === 'connecting' ||
        state === 'connected';

    return (
        <>
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
                                                : 'Đã kết nối'
                                    }
                                </p>
                            </div>

                            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                                {state}
                            </span>
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
                                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
                                        {state === 'calling'
                                            ? 'Đang chờ người nhận...'
                                            : 'Đang thiết lập kết nối...'}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex min-h-64 flex-col items-center justify-center bg-slate-950 text-white">
                                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-3xl">
                                    📞
                                </div>
                                <p className="font-medium">{displayName}</p>
                                <p className="mt-1 text-sm text-slate-400">
                                    {state === 'calling'
                                        ? 'Đang gọi...'
                                        : state === 'connecting'
                                            ? 'Đang kết nối...'
                                            : 'Cuộc gọi đang diễn ra'}
                                </p>
                                <audio ref={remoteAudioRef} autoPlay />
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-3 border-t border-slate-800 px-4 py-4">
                            <button
                                type="button"
                                onClick={toggleMute}
                                className="rounded-full bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700"
                            >
                                {muted ? 'Bật mic' : 'Tắt mic'}
                            </button>

                            {call?.callType === 'video' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={toggleCamera}
                                        className="rounded-full bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700"
                                    >
                                        {cameraOn ? 'Tắt camera' : 'Bật camera'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={toggleScreenShare}
                                        className="rounded-full bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700"
                                    >
                                        {sharingScreen ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}
                                    </button>
                                </>
                            )}

                            <button
                                type="button"
                                onClick={endCall}
                                className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                            >
                                Kết thúc
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}
