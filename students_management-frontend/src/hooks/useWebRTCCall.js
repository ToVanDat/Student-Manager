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

    const createPeer = useCallback((targetUserId, callId, initiator) => {
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

        pc.onconnectionstatechange = () => {
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
            await startMedia(current.callType);
            setState('connecting');

            if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;

            socket.emit('call:accept', {
                callId: current.callId,
                targetUserId: current.targetUserId,
                callType: current.callType
            });
        } catch (err) {
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
            const current = callRef.current;
            if (!current || current.callId !== data.callId) return;

            try {
                const pc = createPeer(current.targetUserId, current.callId, true);
                localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

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
            const current = callRef.current;
            if (!current || current.callId !== data.callId) return;

            try {
                const pc = peerRef.current || createPeer(current.targetUserId, current.callId, false);
                localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

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
                setState('reconnecting');
            } catch (err) {
                setError(err.message || 'Không thể xử lý offer.');
                cleanup();
            }
        };

        const onAnswer = async data => {
            if (!peerRef.current || callRef.current?.callId !== data.callId) return;
            try {
                await peerRef.current.setRemoteDescription(data.answer);
                for (const candidate of pendingCandidatesRef.current) {
                    await peerRef.current.addIceCandidate(candidate);
                }
                pendingCandidatesRef.current = [];
                setState('connected');
            } catch (err) {
                setError(err.message || 'Không thể xử lý answer.');
                cleanup();
            }
        };

        const onIceCandidate = async data => {
            if (callRef.current?.callId !== data.callId) return;
            const candidate = new RTCIceCandidate(data.candidate);

            if (peerRef.current?.remoteDescription) {
                await peerRef.current.addIceCandidate(candidate);
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
            if (callRef.current?.callId !== data.callId) return;
            cleanup();
        };

        const onError = data => {
            setError(data.message || 'Cuộc gọi không thể thực hiện.');
            cleanup();
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
    }, [cleanup, createPeer]);

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
