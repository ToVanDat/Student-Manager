import { useCallback, useEffect, useRef, useState } from 'react';
import socket from '@/socket/socket.js';

const ICE_SERVERS = [
    import.meta.env.VITE_STUN_SERVER
        ? { urls: import.meta.env.VITE_STUN_SERVER }
        : null,
    import.meta.env.VITE_TURN_SERVER
        ? {
            urls: import.meta.env.VITE_TURN_SERVER,
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL
        }
        : null
].filter(Boolean);

const createCallId = () => {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
};

export default function useWebRTCCall() {
    const peerRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(new MediaStream());
    const pendingCandidatesRef = useRef([]);
    const callRef = useRef(null);

    const [state, setState] = useState('idle');
    const [call, setCall] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [muted, setMuted] = useState(false);
    const [cameraOn, setCameraOn] = useState(false);
    const [sharingScreen, setSharingScreen] = useState(false);
    const [error, setError] = useState('');
    const [callDurationSeconds, setCallDurationSeconds] = useState(0);
    const callConnectedAtRef = useRef(null);
    const callDurationTimerRef = useRef(null);
    const ringTimeoutRef = useRef(null);
    const connectTimeoutRef = useRef(null);
    const recoveryTimerRef = useRef(null);
    const recoveryDeadlineRef = useRef(null);
    const recoveryAttemptsRef = useRef(0);
    const MAX_RECOVERY_ATTEMPTS = 2;
    const RECOVERY_TIMEOUT_MS = 10_000;

    const releaseLocalMedia = useCallback(() => {
        const stream = localStreamRef.current;
        if (!stream) return;

        // Always stop every track before dropping the stream reference.
        // This is especially important for cameras: browsers can keep the
        // hardware locked while a MediaStreamTrack is still live.
        stream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (err) {
                console.warn('[CALL][media] failed to stop local track', {
                    kind: track.kind,
                    trackId: track.id,
                    error: err
                });
            }
        });

        localStreamRef.current = null;
        setLocalStream(null);
        setCameraOn(false);
        setMuted(false);
    }, []);

    const cleanup = useCallback(() => {
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
        if (recoveryDeadlineRef.current) clearTimeout(recoveryDeadlineRef.current);
        ringTimeoutRef.current = null;
        connectTimeoutRef.current = null;
        recoveryTimerRef.current = null;
        recoveryDeadlineRef.current = null;
        recoveryAttemptsRef.current = 0;
        if (callDurationTimerRef.current) clearInterval(callDurationTimerRef.current);
        callDurationTimerRef.current = null;
        callConnectedAtRef.current = null;
        setCallDurationSeconds(0);

        const pc = peerRef.current;
        peerRef.current = null;

        // Close the peer first so no sender keeps the media pipeline alive.
        if (pc) {
            try {
                pc.getSenders().forEach(sender => {
                    if (sender.track) {
                        try {
                            sender.track.stop();
                        } catch (err) {
                            console.warn('[CALL][media] failed to stop sender track', err);
                        }
                    }
                });
                pc.close();
            } catch (err) {
                console.warn('[CALL][cleanup] failed to close peer connection', err);
            }
        }

        // Release camera + microphone every time a call ends, is rejected,
        // times out, or the hook is unmounted.
        releaseLocalMedia();

        remoteStreamRef.current.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (err) {
                console.warn('[CALL][media] failed to stop remote track', err);
            }
        });
        remoteStreamRef.current = new MediaStream();

        pendingCandidatesRef.current = [];
        callRef.current = null;
        setRemoteStream(null);
        setCall(null);
        setSharingScreen(false);
        setState('idle');
    }, [releaseLocalMedia]);

    const addLocalTracksToPeer = useCallback((pc) => {
        const stream = localStreamRef.current;
        if (!stream) return;

        for (const track of stream.getTracks()) {
            const alreadyAdded = pc.getSenders().some(sender => sender.track?.id === track.id);
            if (!alreadyAdded) {
                pc.addTrack(track, stream);
            }
        }
    }, []);

    const createPeer = useCallback((targetUserId, callId) => {
        const pc = new RTCPeerConnection({
            iceServers: ICE_SERVERS
        });

        pc.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('call:ice-candidate', {
                    callId,
                    targetUserId,
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = event => {
            const stream = remoteStreamRef.current;
            const exists = stream.getTracks().some(track => track.id === event.track.id);
            if (!exists) stream.addTrack(event.track);
            setRemoteStream(stream);
        };

        pc.oniceconnectionstatechange = () => {
            console.log('[WebRTC][ICE]', callId, pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                setError('ICE không thể tìm được đường kết nối. Kiểm tra STUN/TURN hoặc mạng.');
            }
        };

        pc.onicegatheringstatechange = () => {
            console.log('[WebRTC][ICE gathering]', callId, pc.iceGatheringState);
        };

        pc.onsignalingstatechange = () => {
            console.log('[WebRTC][signaling]', callId, pc.signalingState);
        };

        pc.onconnectionstatechange = () => {
            console.log('[WebRTC][connection]', callId, pc.connectionState);
            const current = callRef.current;

            if (pc.connectionState === 'connected') {
                // Start the duration exactly once, when WebRTC first connects.
                // Keep the same start time through a temporary reconnection.
                if (callConnectedAtRef.current === null) {
                    callConnectedAtRef.current = Date.now();
                    setCallDurationSeconds(0);
                }

                // The connection-establishment timeout must never end a call
                // after WebRTC has successfully connected.
                if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
                connectTimeoutRef.current = null;

                recoveryAttemptsRef.current = 0;
                if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
                if (recoveryDeadlineRef.current) clearTimeout(recoveryDeadlineRef.current);
                recoveryTimerRef.current = null;
                recoveryDeadlineRef.current = null;

                if (current) {
                    socket.emit('call:connected', {
                        callId: current.callId,
                        targetUserId: current.targetUserId
                    });
                }
                setState('connected');
                return;
            }

            if (
                (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') &&
                current
            ) {
                setState('reconnecting');

                // A peer can remain in "disconnected" without firing another
                // connection-state event. Keep a hard deadline so the UI can
                // never stay in reconnecting forever.
                if (!recoveryDeadlineRef.current) {
                    recoveryDeadlineRef.current = setTimeout(() => {
                        recoveryDeadlineRef.current = null;
                        const activeCall = callRef.current;

                        if (!activeCall || peerRef.current !== pc) return;

                        setError('Không thể khôi phục kết nối cuộc gọi.');
                        socket.emit('call:end', {
                            callId: activeCall.callId,
                            targetUserId: activeCall.targetUserId,
                            reason: 'reconnect-timeout'
                        });
                        cleanup();
                    }, RECOVERY_TIMEOUT_MS);
                }

                if (!recoveryTimerRef.current && recoveryAttemptsRef.current < MAX_RECOVERY_ATTEMPTS) {
                    recoveryTimerRef.current = setTimeout(() => {
                        recoveryTimerRef.current = null;
                        const activeCall = callRef.current;

                        if (!activeCall || peerRef.current !== pc) return;

                        recoveryAttemptsRef.current += 1;
                        console.log('[WebRTC][reconnect attempt]', {
                            callId: activeCall.callId,
                            attempt: recoveryAttemptsRef.current,
                            maxAttempts: MAX_RECOVERY_ATTEMPTS
                        });

                        socket.emit('call:reconnect-request', {
                            callId: activeCall.callId,
                            targetUserId: activeCall.targetUserId
                        });
                    }, 2000);
                }
            }

            if (pc.connectionState === 'closed') {
                cleanup();
            }
        };

        peerRef.current = pc;
        return pc;
    }, [cleanup]);

    const startMedia = useCallback(async (callType) => {
        // A previous call can leave a live MediaStreamTrack behind if the
        // component was reused without a full page reload. Release it before
        // asking the browser for the camera again.
        if (localStreamRef.current) {
            console.log('[CALL][media] releasing previous local stream before acquire');
            releaseLocalMedia();
        }

        const constraints = {
            audio: true,
            video: callType === 'video'
        };

        try {
            let stream;

            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (mediaError) {
                const canFallbackToAudioOnly =
                    callType === 'video' &&
                    ['NotReadableError', 'NotFoundError', 'OverconstrainedError', 'AbortError']
                        .includes(mediaError?.name);

                if (!canFallbackToAudioOnly) throw mediaError;

                console.warn('[CALL][media] camera unavailable; retrying audio-only', {
                    name: mediaError?.name,
                    message: mediaError?.message
                });

                // A busy/unavailable camera should not prevent the user from
                // completing a call when the microphone is still available.
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false
                });

                setError(
                    'Không thể sử dụng camera (có thể đang được ứng dụng hoặc trình duyệt khác sử dụng). Cuộc gọi sẽ tiếp tục bằng âm thanh.'
                );
            }

            // Guard against a race where another cleanup happened while
            // getUserMedia() was resolving.
            if (!callRef.current) {
                stream.getTracks().forEach(track => track.stop());
                throw new Error('Cuộc gọi đã kết thúc trước khi thiết bị sẵn sàng.');
            }

            localStreamRef.current = stream;
            setLocalStream(stream);
            setCameraOn(callType === 'video' && stream.getVideoTracks().length > 0);

            console.log('[CALL][media] acquired', {
                callType,
                audioTracks: stream.getAudioTracks().length,
                videoTracks: stream.getVideoTracks().length,
                audioOnlyFallback: callType === 'video' && stream.getVideoTracks().length === 0
            });

            return stream;
        } catch (err) {
            console.error('[CALL][media] getUserMedia failed', {
                callType,
                name: err?.name,
                message: err?.message
            });

            // If acquisition partially created tracks before failing, make
            // sure those tracks are released as well.
            releaseLocalMedia();
            throw err;
        }
    }, [releaseLocalMedia]);

    const startCall = useCallback(async (targetUserId, callType = 'voice', targetProfile = {}) => {
        if (!socket.connected) {
            setError('Socket chưa kết nối.');
            return;
        }

        try {
            setError('');
            const callId = createCallId();

            // Set the call context before acquiring media. startMedia() uses
            // this reference to detect a real cancellation/race while the
            // browser is opening the camera.
            callRef.current = {
                callId,
                targetUserId: Number(targetUserId),
                callType,
                remoteUsername: targetProfile?.name || targetProfile?.username || 'User',
                remoteAvatar: targetProfile?.avatar || null
            };
            setCall(callRef.current);

            await startMedia(callType);

            // Start the visual countdown only once the call invitation is sent.
            const ringingCall = {
                ...callRef.current,
                ringStartedAt: Date.now(),
                ringTimeoutMs: 30_000
            };
            callRef.current = ringingCall;
            setCall(ringingCall);
            setState('calling');

            socket.emit('call:start', {
                callId,
                targetUserId: Number(targetUserId),
                callType
            });

            // The countdown is display-only. The server/database owns expiry
            // and will emit call:timeout when the persisted deadline is reached.
        } catch (err) {
            setError(err.message || 'Không thể truy cập microphone/camera.');
            cleanup();
        }
    }, [cleanup, startMedia]);

    const acceptCall = useCallback(async () => {
        const current = callRef.current;
        if (!current) return;

        try {
            setError('');

            console.log('[CALL][accept clicked]', {
                callId: current.callId,
                targetUserId: current.targetUserId,
                callType: current.callType,
                socketConnected: socket.connected
            });

            console.log('[CALL][media] requesting devices...', {
                callId: current.callId,
                audio: true,
                video: current.callType === 'video'
            });

            await startMedia(current.callType);

            console.log('[CALL][media] devices acquired', {
                callId: current.callId,
                stream: !!localStreamRef.current,
                audioTracks: localStreamRef.current?.getAudioTracks().length || 0,
                videoTracks: localStreamRef.current?.getVideoTracks().length || 0
            });

            setState('connecting');

            if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;

            console.log('[CALL][accept emit]', {
                callId: current.callId,
                targetUserId: current.targetUserId,
                callType: current.callType
            });
            socket.emit('call:accept', {
                callId: current.callId,
                targetUserId: current.targetUserId,
                callType: current.callType
            });
        } catch (err) {
            console.error('[CALL][accept/media error]', {
                callId: current.callId,
                name: err?.name,
                message: err?.message,
                socketConnected: socket.connected
            });

            socket.emit('call:reject', {
                callId: current.callId,
                targetUserId: current.targetUserId,
                reason: 'media-permission-denied'
            });
            setError(err.message || 'Không thể truy cập thiết bị.');
            cleanup();
        }
    }, [cleanup, startMedia]);

    const rejectCall = useCallback(() => {
        const current = callRef.current;
        if (!current) return;
        socket.emit('call:reject', {
            callId: current.callId,
            targetUserId: current.targetUserId
        });
        cleanup();
    }, [cleanup]);

    const endCall = useCallback(() => {
        const current = callRef.current;
        if (current) {
            socket.emit('call:end', {
                callId: current.callId,
                targetUserId: current.targetUserId
            });
        }
        cleanup();
    }, [cleanup]);

    const toggleMute = useCallback(() => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        setMuted(!track.enabled);
    }, []);

    const toggleScreenShare = useCallback(async () => {
        const pc = peerRef.current;
        const current = localStreamRef.current;
        if (!pc || !current) return;

        try {
            if (sharingScreen) {
                const cameraTrack = current.getVideoTracks().find(track => track.kind === 'video');
                if (cameraTrack) {
                    const sender = pc.getSenders().find(item => item.track?.kind === 'video');
                    if (sender) await sender.replaceTrack(cameraTrack);
                }
                setSharingScreen(false);
                return;
            }

            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });
            const screenTrack = screenStream.getVideoTracks()[0];
            const sender = pc.getSenders().find(item => item.track?.kind === 'video');

            if (!sender) {
                screenTrack.stop();
                throw new Error('Screen sharing chỉ khả dụng trong Video Call.');
            }

            await sender.replaceTrack(screenTrack);
            setSharingScreen(true);
            screenTrack.onended = async () => {
                const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
                if (cameraTrack) await sender.replaceTrack(cameraTrack);
                setSharingScreen(false);
            };
        } catch (err) {
            if (err?.name !== 'NotAllowedError') {
                setError(err.message || 'Không thể chia sẻ màn hình.');
            }
        }
    }, [sharingScreen]);

    const toggleCamera = useCallback(() => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        setCameraOn(track.enabled);
    }, []);

    useEffect(() => {
        if (
            !callConnectedAtRef.current ||
            !['connected', 'reconnecting'].includes(state)
        ) {
            if (callDurationTimerRef.current) clearInterval(callDurationTimerRef.current);
            callDurationTimerRef.current = null;
            return;
        }

        const updateDuration = () => {
            const elapsed = Math.floor((Date.now() - callConnectedAtRef.current) / 1000);
            setCallDurationSeconds(Math.max(elapsed, 0));
        };

        updateDuration();
        if (callDurationTimerRef.current) clearInterval(callDurationTimerRef.current);
        callDurationTimerRef.current = setInterval(updateDuration, 1000);

        return () => {
            if (callDurationTimerRef.current) clearInterval(callDurationTimerRef.current);
            callDurationTimerRef.current = null;
        };
    }, [state]);

    useEffect(() => {
        return () => {
            // Socket listener cleanup is not enough: MediaStreams and
            // RTCPeerConnections survive independently of React listeners.
            cleanup();
        };
    }, [cleanup]);

    useEffect(() => {
        const onIncoming = data => {
            if (callRef.current?.callId === data.callId) return;
            console.log('[CALL][incoming]', data);
            const serverNowMs = Date.parse(data.serverNow || new Date().toISOString());
            const expiresAtMs = Date.parse(data.expiresAt || '');
            const remainingMs = Number.isFinite(expiresAtMs)
                ? expiresAtMs - serverNowMs
                : 30_000;

            // A delayed/replayed stale invitation must never reopen the dialog.
            // Ask the server to reconcile instead of deciding call status here.
            if (remainingMs <= 0) {
                socket.emit('call:sync-pending');
                return;
            }

            setError('');
            const ringTimeoutMs = 30_000;
            callRef.current = {
                callId: data.callId,
                targetUserId: Number(data.fromUserId),
                callType: data.callType || 'voice',
                remoteUsername: data.fromUsername,
                expiresAt: data.expiresAt || null,
                ringTimeoutMs,
                ringStartedAt: Date.now() - Math.max(0, ringTimeoutMs - remainingMs)
            };
            setCall(callRef.current);
            setState('incoming');
        };

        const onAccepted = async data => {
            console.log('[CALL][accepted]', data);
            const current = callRef.current;
            if (!current || current.callId !== data.callId) return;

            // The receiver accepted the call, so stop the caller's ring timeout.
            // Otherwise it can clean up an already-connected call after 31 seconds.
            if (ringTimeoutRef.current) {
                clearTimeout(ringTimeoutRef.current);
                ringTimeoutRef.current = null;
            }

            try {
                const pc = createPeer(current.targetUserId, current.callId);
                addLocalTracksToPeer(pc);

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                socket.emit('call:offer', {
                    callId: current.callId,
                    targetUserId: current.targetUserId,
                    offer: pc.localDescription
                });
                setState('connecting');
                connectTimeoutRef.current = setTimeout(() => {
                    connectTimeoutRef.current = null;
                    if (callRef.current?.callId !== current.callId) return;

                    // A delayed timer callback must not tear down a call that
                    // has already connected successfully.
                    if (peerRef.current?.connectionState === 'connected') return;

                    setError('Không thể thiết lập kết nối cuộc gọi.');
                    cleanup();
                }, 16_000);
            } catch (err) {
                setError(err.message || 'Không thể tạo offer.');
                cleanup();
            }
        };

        const onReconnectRequest = async data => {
            const current = callRef.current;
            const pc = peerRef.current;
            if (!current || !pc || current.callId !== data.callId) return;

            if (current.callType && pc.connectionState === 'connected') return;

            try {
                setState('reconnecting');
                pc.restartIce();
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);

                socket.emit('call:offer', {
                    callId: current.callId,
                    targetUserId: current.targetUserId,
                    offer: pc.localDescription
                });
            } catch (err) {
                setError(err.message || 'Không thể khôi phục kết nối.');
            }
        };

        const onOffer = async data => {
            console.log('[CALL][offer received]', { callId: data?.callId, fromUserId: data?.fromUserId });
            const current = callRef.current;
            if (!current || current.callId !== data.callId) return;

            try {
                const pc = peerRef.current || createPeer(current.targetUserId, current.callId);
                addLocalTracksToPeer(pc);

                await pc.setRemoteDescription(data.offer);
                for (const candidate of pendingCandidatesRef.current) {
                    await pc.addIceCandidate(candidate);
                }
                pendingCandidatesRef.current = [];

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('call:answer', {
                    callId: current.callId,
                    targetUserId: current.targetUserId,
                    answer: pc.localDescription
                });
                setState('connecting');
            } catch (err) {
                console.error('[WebRTC] OFFER ERROR:', err);
                setError(err.message || 'Không thể xử lý offer.');
                // Do not immediately destroy the call UI. The connection state/timeout
                // will decide whether the call should actually end.
            }
        };

        const onAnswer = async data => {
            console.log('[CALL][answer received]', { callId: data?.callId, fromUserId: data?.fromUserId });
            if (!peerRef.current || callRef.current?.callId !== data.callId) return;
            try {
                await peerRef.current.setRemoteDescription(data.answer);
                for (const candidate of pendingCandidatesRef.current) {
                    await peerRef.current.addIceCandidate(candidate);
                }
                pendingCandidatesRef.current = [];
                setState('connecting');
            } catch (err) {
                console.error('[WebRTC] ANSWER ERROR:', err);
                setError(err.message || 'Không thể xử lý answer.');
            }
        };

        const onIceCandidate = async data => {
            if (callRef.current?.callId !== data.callId) return;
            const candidate = new RTCIceCandidate(data.candidate);

            if (peerRef.current?.remoteDescription) {
                try {
                    await peerRef.current.addIceCandidate(candidate);
                } catch (err) {
                    console.warn('[WebRTC] ICE candidate error:', err);
                }
            } else {
                pendingCandidatesRef.current.push(candidate);
            }
        };

        const onRejected = data => {
            if (callRef.current?.callId !== data.callId) return;
            setError(data.reason === 'media-permission-denied'
                ? 'Người nhận không cấp quyền microphone/camera.'
                : 'Cuộc gọi bị từ chối.');
            cleanup();
        };

        const onTimeout = data => {
            if (callRef.current?.callId !== data.callId) return;

            let message = 'Cuộc gọi đã kết thúc.';

            switch (data.reason) {
                case 'user-offline':
                    message = 'Người dùng đang ngoại tuyến. Cuộc gọi đã được ghi nhận là cuộc gọi nhỡ.';
                    break;
                case 'ring-timeout':
                    message = 'Không có người trả lời. Cuộc gọi đã được ghi nhận là cuộc gọi nhỡ.';
                    break;
                case 'connection-timeout':
                    message = 'Hai thiết bị không thể thiết lập kết nối cuộc gọi.';
                    break;
                default:
                    message = data.status === 'missed'
                        ? 'Cuộc gọi đã được ghi nhận là cuộc gọi nhỡ.'
                        : 'Cuộc gọi không thể kết nối.';
            }

            console.warn('[CALL][timeout]', {
                callId: data.callId,
                status: data.status,
                reason: data.reason,
                message
            });

            setError(message);
            cleanup();
        };

        const onEnded = data => {
            console.warn('[CALL][ended]', data);
            if (callRef.current?.callId !== data.callId) return;
            cleanup();
        };

        const onError = data => {
            console.error('[CALL][error]', data);
            // Ignore stale errors from another/previous call. Backend always
            // includes callId for call lifecycle errors.
            if (data?.callId && callRef.current?.callId !== data.callId) return;

            setError(data.message || 'Cuộc gọi không thể thực hiện.');
            if (!data?.callId || callRef.current?.callId === data.callId) {
                cleanup();
            }
        };

        const onSocketConnect = () => socket.emit('call:sync-pending');

        socket.on('connect', onSocketConnect);
        socket.on('call:incoming', onIncoming);
        socket.on('call:reconnect-request', onReconnectRequest);
        socket.on('call:accepted', onAccepted);
        socket.on('call:offer', onOffer);
        socket.on('call:answer', onAnswer);
        socket.on('call:ice-candidate', onIceCandidate);
        socket.on('call:rejected', onRejected);
        socket.on('call:timeout', onTimeout);
        socket.on('call:ended', onEnded);
        socket.on('call:error', onError);

        // Handle hooks mounted after Socket.IO has already connected.
        if (socket.connected) socket.emit('call:sync-pending');

        return () => {
            socket.off('connect', onSocketConnect);
            socket.off('call:incoming', onIncoming);
            socket.off('call:reconnect-request', onReconnectRequest);
            socket.off('call:accepted', onAccepted);
            socket.off('call:offer', onOffer);
            socket.off('call:answer', onAnswer);
            socket.off('call:ice-candidate', onIceCandidate);
            socket.off('call:rejected', onRejected);
            socket.off('call:timeout', onTimeout);
            socket.off('call:ended', onEnded);
            socket.off('call:error', onError);
        };
    }, [cleanup, createPeer, addLocalTracksToPeer]);

    return {
        state,
        call,
        localStream,
        remoteStream,
        muted,
        cameraOn,
        error,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        toggleScreenShare,
        sharingScreen,
        callDurationSeconds,
        cleanup
    };
}
