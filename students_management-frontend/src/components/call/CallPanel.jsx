import { useEffect, useRef } from 'react';
import useWebRTCCall from '@/hooks/useWebRTCCall.js';

export default function CallPanel({ targetUserId, targetUsername }) {
    const {
        state, call, localStream, remoteStream, muted, cameraOn, sharingScreen, error,
        startCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera
    } = useWebRTCCall();

    const remoteAudioRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
        }
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [localStream, remoteStream]);

    return (
        <section className="rounded-xl border p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold">1-1 Call</h2>
                    <p className="text-sm opacity-70">
                        {call?.remoteUsername || targetUsername || 'User'}
                    </p>
                </div>
                <span className="text-sm">{state}</span>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {state === 'idle' && (
                <div className="flex gap-2">
                    <button className="px-3 py-2 rounded bg-black text-white"
                        onClick={() => startCall(targetUserId, 'voice')}>
                        Voice Call
                    </button>
                    <button className="px-3 py-2 rounded border"
                        onClick={() => startCall(targetUserId, 'video')}>
                        Video Call
                    </button>
                </div>
            )}

            {state === 'incoming' && (
                <div className="flex gap-2">
                    <button className="px-3 py-2 rounded bg-green-600 text-white"
                        onClick={acceptCall}>
                        Accept
                    </button>
                    <button className="px-3 py-2 rounded bg-red-600 text-white"
                        onClick={rejectCall}>
                        Reject
                    </button>
                </div>
            )}

            {state !== 'idle' && state !== 'incoming' && (
                <>
                    {call?.callType === 'video' && (
                        <div className="grid grid-cols-2 gap-3">
                            <video ref={localVideoRef} autoPlay muted playsInline className="w-full rounded-lg bg-black" />
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-lg bg-black" />
                        </div>
                    )}

                    {call?.callType === 'voice' && (
                        <audio ref={remoteAudioRef} autoPlay />
                    )}

                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded border" onClick={toggleMute}>
                            {muted ? 'Unmute' : 'Mute'}
                        </button>

                        {call?.callType === 'video' && (
                            <button className="px-3 py-2 rounded border" onClick={toggleCamera}>
                                {cameraOn ? 'Camera Off' : 'Camera On'}
                            </button>
                        )}

                        <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={endCall}>
                            End Call
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}
