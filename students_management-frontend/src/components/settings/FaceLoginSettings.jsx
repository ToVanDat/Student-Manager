import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext.jsx';
import { Camera, ShieldCheck, ShieldAlert, Trash2, Video, VideoOff, KeyRound, X } from 'lucide-react';
import {
    beginFaceEnrollmentApi,
    cancelFaceEnrollmentApi,
    captureFaceEnrollmentFrameApi,
    disableFaceLoginApi,
    finishFaceEnrollmentApi,
    getFaceLoginStatusApi,
    getFaceMfaPolicyApi,
    setFaceMfaPolicyApi,
} from '@/api/authApi.js';
import { useAuth } from '@/hooks/useAuth.js';

const FRAME_COUNT = 6;
const FRAME_INTERVAL_MS = 500;

function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

function captureJpeg(video, t) {
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
        throw new Error(t('faceCameraNotReady'));
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error(t('faceCameraProcessorFailed'));
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error(t('faceCameraFrameFailed')));
        }, 'image/jpeg', 0.82);
    });
}

export default function FaceLoginSettings() {
    const { t, language } = useLanguage();
    const { logoutUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [mfaPolicy, setMfaPolicy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [cameraActive, setCameraActive] = useState(false);
    const [progress, setProgress] = useState(0);
    const [instruction, setInstruction] = useState('');
    const [confirmationAction, setConfirmationAction] = useState(null);
    const [confirmationPassword, setConfirmationPassword] = useState('');
    const [confirmationError, setConfirmationError] = useState('');
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const mountedRef = useRef(true);
    const cancelledRef = useRef(false);

    const stopCamera = useCallback(() => {
        cancelledRef.current = true;
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        if (mountedRef.current) setCameraActive(false);
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [nextStatus, nextPolicy] = await Promise.all([getFaceLoginStatusApi(), getFaceMfaPolicyApi()]);
            setStatus(nextStatus);
            setMfaPolicy(nextPolicy);
        } catch (requestError) {
            setError(requestError.response?.data?.message || t('faceStatusLoadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        mountedRef.current = true;
        void refresh();
        return () => {
            mountedRef.current = false;
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        };
    }, [refresh]);

    const enroll = async (currentPassword) => {
        if (!currentPassword) return;
        cancelledRef.current = false;
        setBusy(true);
        setError('');
        setProgress(0);
        setInstruction('');
        let stream;
        let challengeId = null;
        let enrollmentCompleted = false;
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error(t('faceCameraHttpsRequired'));
            }
            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            });
            if (cancelledRef.current) throw new Error(t('faceEnrollmentCancelled'));
            streamRef.current = stream;
            setCameraActive(true);
            // Wait for React to mount the conditional video element before binding the stream.
            await new Promise(resolve => window.requestAnimationFrame(resolve));
            if (!videoRef.current) throw new Error(t('faceCameraPreviewFailed'));
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            if (cancelledRef.current) throw new Error(t('faceEnrollmentCancelled'));

            const challenge = await beginFaceEnrollmentApi(null, currentPassword);
            challengeId = challenge.challengeId;
            if (cancelledRef.current) throw new Error(t('faceEnrollmentCancelled'));
            const actions = Array.isArray(challenge.actions) ? challenge.actions : [];
            setInstruction(t('faceEnrollmentStep', { step: 1, action: actions[0] === 'blink' ? t('faceActionBlink') : t('faceActionSmile') }));
            await wait(1200);

            for (let index = 0; index < FRAME_COUNT; index += 1) {
                if (cancelledRef.current) throw new Error(t('faceEnrollmentCancelled'));
                const frame = await captureJpeg(videoRef.current, t);
                const result = await captureFaceEnrollmentFrameApi(
                    challenge.challengeId,
                    challenge.livenessNonce,
                    frame,
                );
                if (cancelledRef.current) throw new Error(t('faceEnrollmentCancelled'));
                setProgress(Math.min(FRAME_COUNT, result.frameCount || index + 1));
                if (index === Math.floor(FRAME_COUNT / 2) - 1) {
                    setInstruction(t('faceEnrollmentStep', { step: 2, action: actions[1] === 'blink' ? t('faceActionBlink') : t('faceActionSmile') }));
                }
                if (index < FRAME_COUNT - 1) await wait(FRAME_INTERVAL_MS);
            }

            if (cancelledRef.current) throw new Error(t('faceEnrollmentCancelled'));
            await finishFaceEnrollmentApi(challenge.challengeId);
            enrollmentCompleted = true;
            challengeId = null;
            setInstruction(t('faceEnrollmentComplete'));
            await refresh();
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || t('faceEnrollmentFailed'));
        } finally {
            if (challengeId && !enrollmentCompleted) {
                try { await cancelFaceEnrollmentApi(challengeId); }
                catch (cancelError) { console.warn('[FaceLogin] Could not cancel enrollment challenge:', cancelError.message); }
            }
            stream?.getTracks().forEach(track => track.stop());
            if (streamRef.current === stream) streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
            setCameraActive(false);
            setBusy(false);
        }
    };

    const disable = async (currentPassword) => {
        if (!currentPassword) return;
        setBusy(true);
        setError('');
        try {
            await disableFaceLoginApi(currentPassword);
            await refresh();
        } catch (requestError) {
            setError(requestError.response?.data?.message || t('faceDisableFailed'));
        } finally {
            setBusy(false);
        }
    };

    const updateMfaPolicy = async (enabled, currentPassword) => {
        setBusy(true);
        setError('');
        try {
            await setFaceMfaPolicyApi(enabled, currentPassword);
            await logoutUser();
            window.location.assign('/login');
        } catch (requestError) {
            setError(requestError.response?.data?.message || (language === 'vi' ? 'Không thể cập nhật chính sách Face MFA.' : 'Could not update the Face MFA policy.'));
            setBusy(false);
        }
    };

    const requestConfirmation = action => {
        setConfirmationAction(action);
        setConfirmationPassword('');
        setConfirmationError('');
    };

    const closeConfirmation = useCallback(() => {
        if (busy) return;
        setConfirmationAction(null);
        setConfirmationPassword('');
        setConfirmationError('');
    }, [busy]);

    const submitConfirmation = event => {
        event.preventDefault();
        if (!confirmationPassword) {
            setConfirmationError(t('facePasswordRequired'));
            return;
        }
        const password = confirmationPassword;
        const action = confirmationAction;
        setConfirmationAction(null);
        setConfirmationPassword('');
        setConfirmationError('');
        if (action === 'enroll') void enroll(password);
        if (action === 'disable') void disable(password);
        if (action === 'enable-mfa') void updateMfaPolicy(true, password);
        if (action === 'disable-mfa') void updateMfaPolicy(false, password);
    };

    useEffect(() => {
        if (!confirmationAction) return undefined;
        const handleKeyDown = event => {
            if (event.key === 'Escape' && !busy) closeConfirmation();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [confirmationAction, busy, closeConfirmation]);

    const configured = Boolean(status?.configured);
    const available = Boolean(status?.enrollmentAvailable && status?.loginAvailable);

    return (
        <section data-ui-region="face-login" aria-busy={busy || loading} className="relative mb-5 min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:p-5">
            <div className="mb-2 flex items-center gap-2">
                <Camera size={19} className="text-indigo-600" />
                <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">{t('faceLoginTitle')}</h3>
                <span className={configured
                    ? 'ml-auto rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}>
                    {loading ? t('loading') : configured ? t('faceConfigured') : t('faceNotConfigured')}
                </span>
            </div>
            <div className="mb-3 flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="m-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{language === 'vi' ? 'Yêu cầu Face MFA sau đăng nhập' : 'Require Face MFA after sign-in'}</p>
                    <p className="mb-0 mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{language === 'vi' ? 'Khi bật, Password, Google, Passkey và QR đều cần xác minh khuôn mặt trước khi cấp phiên.' : 'When enabled, Password, Google, Passkey and QR sign-ins must pass face verification before a session is issued.'}</p>
                    {!mfaPolicy?.pipelineReady && <p className="mb-0 mt-1 text-xs text-amber-700 dark:text-amber-300">{language === 'vi' ? 'Pipeline Face chưa được kiểm định; chưa thể bật chính sách.' : 'The Face pipeline has not passed validation; this policy cannot be enabled yet.'}</p>}
                </div>
                <button type="button" disabled={busy || loading || (!mfaPolicy?.enabled && (!configured || !available))} onClick={() => requestConfirmation(mfaPolicy?.enabled ? 'disable-mfa' : 'enable-mfa')} aria-pressed={mfaPolicy?.enabled === true} className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${mfaPolicy?.enabled ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
                    {mfaPolicy?.enabled ? (language === 'vi' ? 'Đang bật · Tắt' : 'Enabled · Turn off') : (language === 'vi' ? 'Bật Face MFA' : 'Enable Face MFA')}
                </button>
            </div>
            <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {t('faceLoginExplanation')} {t('faceCameraConsentNote')} {t('faceFramePrivacy')}
            </p>
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                <span>
                    {available
                        ? t('facePipelineReady')
                        : t('faceReleaseGateClosed')}
                </span>
            </div>
            {cameraActive && (
                <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-700">
                    <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
                    <div className="flex items-center justify-between gap-3 p-3 text-xs text-white">
                        <span className="inline-flex items-center gap-2"><Video size={14} /> {t('faceCapturingFrames')}</span>
                        <span>{progress}/{FRAME_COUNT}</span>
                    </div>
                    <div className="h-1 bg-slate-700"><div className="h-1 bg-indigo-400 transition-all" style={{ width: `${progress / FRAME_COUNT * 100}%` }} /></div>
                </div>
            )}
            {instruction && <p className="mb-3 text-xs font-medium text-indigo-700 dark:text-indigo-300">{instruction}</p>}
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy || loading || !available || configured} onClick={() => requestConfirmation('enroll')}
                    title={!available ? t('facePipelinePending') : configured ? t('faceCredentialExists') : t('faceEnrollAction')}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
                    {busy ? <Video size={15} /> : <Camera size={15} />}
                    {busy ? t('processing') : t('faceEnrollAction')}
                </button>
                {configured && <button type="button" disabled={busy || loading} onClick={() => requestConfirmation('disable')}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">
                    <Trash2 size={14} /> {t('disable')}
                </button>}
                {cameraActive && <button type="button" disabled={!busy} onClick={stopCamera}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
                    <VideoOff size={14} /> {t('stopCamera')}
                </button>}
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><ShieldCheck size={13} /> {t('faceSecurityNote')}</span>
            </div>
            {status?.credential?.enrolledAt && <p className="mb-0 mt-3 text-[11px] text-slate-400">{t('registeredAt')}: {new Date(status.credential.enrolledAt).toLocaleString()}</p>}
            {error && <p role="alert" className="mb-0 mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
            {confirmationAction && (
                <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/55 p-4 " onMouseDown={event => { if (event.target === event.currentTarget) closeConfirmation(); }}>
                    <section role="dialog" aria-modal="true" aria-labelledby="face-login-confirm-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:p-6">
                        <header className="mb-4 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"><KeyRound size={19} /></span>
                                <div className="min-w-0">
                                    <h4 id="face-login-confirm-title" className="m-0 text-base font-bold text-slate-900 dark:text-white">{confirmationAction === 'enroll' ? t('faceConfirmEnrollTitle') : confirmationAction === 'disable' ? t('faceConfirmDisableTitle') : confirmationAction === 'enable-mfa' ? (language === 'vi' ? 'Bật yêu cầu Face MFA' : 'Enable required Face MFA') : (language === 'vi' ? 'Tắt yêu cầu Face MFA' : 'Disable required Face MFA')}</h4>
                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{confirmationAction === 'enroll' ? t('faceConfirmEnrollDescription') : confirmationAction === 'disable' ? t('faceConfirmDisableDescription') : (language === 'vi' ? 'Nhập lại mật khẩu để xác nhận thay đổi chính sách. Bạn sẽ phải đăng nhập lại sau thao tác này.' : 'Re-enter your password to confirm this policy change. You will need to sign in again afterward.')}</p>
                                </div>
                            </div>
                            <button type="button" onClick={closeConfirmation} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t("closeDialog")}><X size={17} /></button>
                        </header>
                        <form onSubmit={submitConfirmation} className="grid gap-3">
                            <label htmlFor="face-login-confirm-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('accountPassword')}</label>
                            <input id="face-login-confirm-password" type="password" autoComplete="current-password" autoFocus value={confirmationPassword} onChange={event => setConfirmationPassword(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" required />
                            {confirmationError && <p role="alert" className="m-0 text-xs text-rose-600 dark:text-rose-300">{confirmationError}</p>}
                            <div className="mt-2 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                                <button type="button" onClick={closeConfirmation} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{t('cancel')}</button>
                                <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700"><ShieldCheck size={15} /> {t('confirm')}</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </section>
    );
}
