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
    const ringTimeoutRef = useRef(null);
    const connectTimeoutRef = useRef(null);
    const recoveryTimerRef = useRef(null);
    const recoveryAttemptsRef = useRef(0);
    const MAX_RECOVERY_ATTEMPTS = 2;

    const cleanup = useCallback(() => {
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
        ringTimeoutRef.current = null;
        connectTimeoutRef.current = null;
        recoveryTimerRef.current = null;
        recoveryAttemptsRef.current = 0;
        peerRef.current?.close();
        peerRef.current = null;
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        remoteStreamRef.current = new MediaStream();
        pendingCandidatesRef.current = [];
        callRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);
        setCall(null);
        setMuted(false);
        setCameraOn(false);
        setSharingScreen(false);
        setState('idle');
    }, []);

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
                recoveryAttemptsRef.current = 0;
                if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
                recoveryTimerRef.current = null;

                if (current) {
                    socket.emit('call:connected', {
                        callId: current.callId,
                        targetUserId: current.targetUserId
                    });
                }
                setState('connected');
                return;
            }

            if (pc.connectionState === 'disconnected' && current && !recoveryTimerRef.current) {
                setState('reconnecting');
                recoveryTimerRef.current = setTimeout(() => {
                    recoveryTimerRef.current = null;
                    if (!callRef.current || peerRef.current !== pc) return;

                    if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
                        setError('Kết nối cuộc gọi bị gián đoạn.');
                        cleanup();
                        return;
                    }

                    recoveryAttemptsRef.current += 1;
                    socket.emit('call:reconnect-request', {
                        callId: current.callId,
                        targetUserId: current.targetUserId
                    });
                }, 2000);
            }

            if (pc.connectionState === 'failed') {
                setError('Đang thử khôi phục kết nối cuộc gọi...');
                if (current && recoveryAttemptsRef.current < MAX_RECOVERY_ATTEMPTS) {
                    recoveryAttemptsRef.current += 1;
                    socket.emit('call:reconnect-request', {
                        callId: current.callId,
                        targetUserId: current.targetUserId
                    });
                } else {
                    setError('Không thể khôi phục kết nối cuộc gọi.');
                    cleanup();
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
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video'
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCameraOn(callType === 'video');
        return stream;
    }, []);

    const startCall = useCallback(async (targetUserId, callType = 'voice') => {
        if (!socket.connected) {
            setError('Socket chưa kết nối.');
            return;
        }

        try {
            setError('');
            const callId = createCallId();
            await startMedia(callType);

            callRef.current = {
                callId,
                targetUserId: Number(targetUserId),
                callType
            };
            setCall(callRef.current);
            setState('calling');

            socket.emit('call:start', {
                callId,
                targetUserId: Number(targetUserId),
                callType
            });

            ringTimeoutRef.current = setTimeout(() => {
                if (callRef.current?.callId !== callId) return;
                setError('Không có người trả lời cuộc gọi.');
                cleanup();
            }, 31_000);
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
        const onIncoming = data => {
            console.log('[CALL][incoming]', data);
            // A previous call may have left an error message in state.
            // Never carry that stale error into a new incoming-call dialog.
            setError('');
            callRef.current = {
                callId: data.callId,
                targetUserId: Number(data.fromUserId),
                callType: data.callType || 'voice',
                remoteUsername: data.fromUsername
            };
            setCall(callRef.current);
            setState('incoming');
        };

        const onAccepted = async data => {
            console.log('[CALL][accepted]', data);
            const current = callRef.current;
            if (!current || current.callId !== data.callId) return;

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
                    if (callRef.current?.callId !== current.callId) return;
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
            setError(data.status === 'missed'
                ? 'Cuộc gọi không được trả lời.'
                : 'Cuộc gọi không thể kết nối.');
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

        return () => {
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
        cleanup
    };
}
