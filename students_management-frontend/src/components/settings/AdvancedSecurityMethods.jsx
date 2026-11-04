import { useCallback, useEffect, useRef, useState } from 'react';
import { Fingerprint, Link2, Trash2, Unlink, ShieldCheck } from 'lucide-react';
import FaceLoginSettings from './FaceLoginSettings.jsx';
import { useLanguage } from '@/context/LanguageContext.jsx';
import {
    beginPasskeyRegistrationApi, finishPasskeyRegistrationApi, listPasskeysApi,
    deletePasskeyApi, linkGoogleApi, getGoogleLinkApi, unlinkGoogleApi,
    beginSensitiveReauthApi, finishSensitiveReauthApi, getBiometricLoginStatusApi
} from '@/api/authApi.js';

const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export default function AdvancedSecurityMethods() {
    const { t } = useLanguage();
    const [credentials, setCredentials] = useState([]);
    const [biometricStatus, setBiometricStatus] = useState(null);
    const [passkeysLoading, setPasskeysLoading] = useState(true);
    const [passkeysError, setPasskeysError] = useState('');
    const [googleStatusLoading, setGoogleStatusLoading] = useState(true);
    const [googleStatusError, setGoogleStatusError] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [confirmation, setConfirmation] = useState(null);
    const cancelConfirmationRef = useRef(null);
    const [googleLink, setGoogleLink] = useState(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [verificationToken, setVerificationToken] = useState('');
    const verificationTokenRef = useRef('');
    useEffect(() => { verificationTokenRef.current = verificationToken; }, [verificationToken]);
    const googleButtonRef = useRef(null);
    const currentPasswordRef = useRef('');
    useEffect(() => { currentPasswordRef.current = currentPassword; }, [currentPassword]);
    const refresh = useCallback(async () => {
        setPasskeysLoading(true);
        setGoogleStatusLoading(true);
        setPasskeysError('');
        setGoogleStatusError('');
        const [passkeysResult, googleResult, biometricResult] = await Promise.allSettled([
            listPasskeysApi(),
            getGoogleLinkApi(),
            getBiometricLoginStatusApi()
        ]);
        if (passkeysResult.status === 'fulfilled') {
            setCredentials(passkeysResult.value);
        } else {
            setPasskeysError(passkeysResult.reason?.response?.data?.message || t('passkeysLoadFailed'));
        }

        if (biometricResult.status === 'fulfilled') {
            setBiometricStatus(biometricResult.value);
        } else {
            setBiometricStatus(null);
        }

        if (googleResult.status === 'fulfilled') {
            setGoogleLink(googleResult.value);
        } else {
            setGoogleStatusError(googleResult.reason?.response?.data?.message || t('googleLinkStatusFailed'));
        }

        setPasskeysLoading(false);
        setGoogleStatusLoading(false);
    }, [t]);

    useEffect(() => { void refresh(); }, [refresh]);

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (googleStatusLoading || googleStatusError || googleLink || !clientId || !googleButtonRef.current) return undefined;
        let cancelled = false;
        const initialize = () => {
            if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
            window.google.accounts.id.initialize({
                client_id: clientId,
                auto_select: false,
                callback: async response => {
                    if (!response?.credential) return;
                    if (!currentPasswordRef.current && !verificationTokenRef.current) {
                        setMessage(t('googleLinkReauthRequired'));
                        return;
                    }
                    setBusy(true);
                    setMessage('');
                    try {
                        await linkGoogleApi(response.credential, currentPasswordRef.current || undefined, verificationTokenRef.current || undefined);
                        setCurrentPassword('');
                        setVerificationToken('');
                        setMessage(t('googleLinkSuccess'));
                        await refresh();
                    } catch (error) {
                        setMessage(error.response?.data?.message || t('googleLinkFailed'));
                    } finally { setBusy(false); }
                }
            });
            window.google.accounts.id.renderButton(googleButtonRef.current, {
                type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
                shape: 'rectangular', width: 300
            });
        };
        if (window.google?.accounts?.id) initialize();
        else {
            let script = document.querySelector('script[data-google-identity]');
            if (!script) {
                script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.dataset.googleIdentity = 'true';
                document.head.appendChild(script);
            }
            script.addEventListener('load', initialize);
        }
        return () => {
            cancelled = true;
            const script = document.querySelector('script[data-google-identity]');
            script?.removeEventListener('load', initialize);
        };
    }, [googleStatusLoading, googleStatusError, googleLink, refresh]);

    const registerPasskey = async () => {
        setBusy(true);
        setMessage('');
        try {
            if (!window.isSecureContext || !navigator.credentials?.create) {
                throw new Error(t('passkeyHttpsRequired'));
            }
            const { challengeId, options } = await beginPasskeyRegistrationApi();
            const publicKey = {
                ...options,
                challenge: decode(options.challenge),
                user: { ...options.user, id: decode(options.user.id) },
                excludeCredentials: (options.excludeCredentials || []).map(item => ({ ...item, id: decode(item.id) }))
            };
            const credential = await navigator.credentials.create({ publicKey });
            if (!credential) throw new Error(t('passkeyRegistrationCancelled'));
            const response = {
                id: credential.id,
                rawId: encode(credential.rawId),
                type: credential.type,
                authenticatorAttachment: credential.authenticatorAttachment,
                response: {
                    clientDataJSON: encode(credential.response.clientDataJSON),
                    attestationObject: encode(credential.response.attestationObject),
                    transports: credential.response.getTransports?.() || []
                },
                clientExtensionResults: credential.getClientExtensionResults()
            };
            await finishPasskeyRegistrationApi(challengeId, response, navigator.userAgent.slice(0, 100));
            setMessage(t('passkeyRegistrationSuccess'));
            await refresh();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || t('passkeyRegistrationFailed'));
        } finally { setBusy(false); }
    };

    const verifyWithPasskey = async purpose => {
        setBusy(true);
        setMessage('');
        try {
            if (!window.isSecureContext || !navigator.credentials?.get) throw new Error(t('passkeyHttpsRequired'));
            const { challengeId, options } = await beginSensitiveReauthApi(purpose);
            const publicKey = {
                ...options,
                challenge: decode(options.challenge),
                allowCredentials: (options.allowCredentials || []).map(item => ({ ...item, id: decode(item.id) }))
            };
            const credential = await navigator.credentials.get({ publicKey });
            if (!credential) throw new Error(t('passkeyVerificationCancelled'));
            const response = {
                id: credential.id,
                rawId: encode(credential.rawId),
                type: credential.type,
                authenticatorAttachment: credential.authenticatorAttachment,
                response: {
                    clientDataJSON: encode(credential.response.clientDataJSON),
                    authenticatorData: encode(credential.response.authenticatorData),
                    signature: encode(credential.response.signature),
                    userHandle: credential.response.userHandle ? encode(credential.response.userHandle) : null
                },
                clientExtensionResults: credential.getClientExtensionResults()
            };
            const result = await finishSensitiveReauthApi(challengeId, response, purpose);
            setVerificationToken(result.verificationToken);
            setMessage(t('passkeyVerificationSuccess'));
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || t('passkeyVerificationFailed'));
        } finally { setBusy(false); }
    };

    const unlinkGoogle = async () => {
        if (!currentPassword && !verificationToken) {
            setMessage(t('googleUnlinkReauthRequired'));
            return;
        }
        setConfirmation({ type: 'unlink-google' });
    };

    const removePasskey = id => setConfirmation({ type: 'remove-passkey', id });

    const confirmSensitiveAction = async () => {
        if (!confirmation || busy) return;
        const action = confirmation;
        setConfirmation(null);
        setBusy(true);
        setMessage('');
        try {
            if (action.type === 'unlink-google') {
                await unlinkGoogleApi(currentPassword || undefined, verificationToken || undefined);
                setCurrentPassword('');
                setVerificationToken('');
                setMessage(t('googleUnlinkSuccess'));
            } else if (action.type === 'remove-passkey') {
                await deletePasskeyApi(action.id);
                setMessage(t('passkeyDeleted'));
            }
            await refresh();
        } catch (error) {
            setMessage(error.response?.data?.message || (action.type === 'unlink-google' ? t('googleUnlinkFailed') : t('passkeyDeleteFailed')));
        } finally { setBusy(false); }
    };

    useEffect(() => {
        if (!confirmation) return undefined;
        const previousFocus = document.activeElement;
        cancelConfirmationRef.current?.focus();
        const onKeyDown = event => {
            if (event.key === 'Escape' && !busy) setConfirmation(null);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previousFocus?.focus?.();
        };
    }, [confirmation, busy]);

    return (
        <section className="settings-advanced-security mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:p-5" data-ui-region="advanced-security-methods" aria-busy={busy || passkeysLoading || googleStatusLoading}>
            <FaceLoginSettings />
            <div className="mb-3 flex items-center gap-2">
                <Fingerprint size={19} className="text-blue-600" />
                <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">{t('passkeyGoogleTitle')}</h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {t('passkeyExplanation')}
            </p>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200"><ShieldCheck size={15} /> {t('passkeySignInLabel')}</div>
                <span className={((biometricStatus?.configured ?? (credentials.length > 0))) ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300'}>{(biometricStatus?.configured ?? (credentials.length > 0)) ? t('passkeyConfiguredCount', { count: biometricStatus?.credentialCount ?? credentials.length }) : t('faceNotConfigured')}</span>
            </div>
            <button type="button" disabled={busy} onClick={registerPasskey} className="mb-4 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                <Fingerprint size={16} /> {credentials.length ? t('addPasskey') : t('registerPasskey')}
            </button>
            <div className="settings-passkey-list mb-4 space-y-2" data-ui-region="passkey-list">
                {credentials.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                        <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{item.device_name || t('passkey')}</p>
                            <p className="m-0 mt-1 text-[11px] text-slate-400">{t('registeredAt')}: {new Date(item.created_at).toLocaleString()}</p>
                        </div>
                        <button type="button" disabled={busy} onClick={() => removePasskey(item.id)} aria-label={t('removePasskeyAriaLabel', { name: item.device_name || '' })} className="min-h-10 min-w-10 rounded-lg p-2 text-rose-600 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50 dark:hover:bg-rose-950/30"><Trash2 size={16} /></button>
                    </div>
                ))}
                {passkeysLoading && <p role="status" className="text-xs text-slate-500">{t('loadingPasskeys')}</p>}
                {!passkeysLoading && passkeysError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{passkeysError}<button type="button" onClick={() => void refresh()} className="ml-2 font-semibold underline">{t('retry')}</button></div>}
                {!passkeysLoading && !passkeysError && !credentials.length && <p className="text-xs text-slate-400">{t('noPasskeysHint')}</p>}
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><Link2 size={15} /> {t('googleLinkTitle')}</div>
            {googleStatusLoading && <p role="status" className="text-xs text-slate-500">{t('checkingGoogleStatus')}</p>}
            {!googleStatusLoading && googleStatusError && <div role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{googleStatusError}<button type="button" onClick={() => void refresh()} className="ml-2 font-semibold underline">{t('retry')}</button></div>}
            {!googleStatusLoading && !googleStatusError && !googleLink && <div className="mb-3 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200" htmlFor="link-google-password">{t('verifyWithAccountPassword')}</label>
                <input id="link-google-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder={t('currentAccountPassword')} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                <p className="m-0 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('googleLinkInstructions')}</p>
                <button type="button" disabled={busy} onClick={() => verifyWithPasskey('google-link')} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Fingerprint size={14} /> {t('verifyWithPasskey')}</button>
                {verificationToken && <p className="m-0 text-xs text-emerald-700 dark:text-emerald-300">{t('passkeyVerifiedContinueGoogle')}</p>}
                <div ref={googleButtonRef} className={busy ? 'pointer-events-none opacity-50' : ''} />
            </div>}
            {!googleStatusLoading && !googleStatusError && googleLink ? (
                <div className="settings-google-link-card space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <p className="m-0 text-sm font-medium text-slate-800 dark:text-slate-100">{t('googleLinked')}</p>
                    <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{googleLink.provider_email || t('linkedGoogleAccount')}</p>
                    <label className="block text-xs text-slate-600 dark:text-slate-300" htmlFor="unlink-google-password">{t('verifyWithAccountPassword')} hoặc passkey</label>
                    <input id="unlink-google-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                    <button type="button" disabled={busy || (!currentPassword && !verificationToken)} onClick={unlinkGoogle} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"><Unlink size={14} /> {t('unlinkGoogle')}</button>
                    <button type="button" disabled={busy} onClick={() => verifyWithPasskey('google-unlink')} className="ml-2 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><Fingerprint size={14} /> {t('verifyWithPasskey')}</button>
                    {verificationToken && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{t('passkeyVerified')}</p>}
                </div>
            ) : null}
            {!googleStatusLoading && !googleStatusError && !googleLink && !import.meta.env.VITE_GOOGLE_CLIENT_ID && <p className="mt-2 text-xs text-slate-400">{t('googleClientIdRequired')}</p>}
            {message && <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{message}</p>}
            {confirmation && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setConfirmation(null); }}>
                    <section role="alertdialog" aria-modal="true" aria-labelledby="security-confirm-title" aria-describedby="security-confirm-description" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="mb-3 flex items-center gap-2 text-rose-600 dark:text-rose-400"><ShieldCheck size={19} /><span className="text-xs font-bold uppercase tracking-wide">{t('confirmSecurityAction')}</span></div>
                        <h4 id="security-confirm-title" className="m-0 text-base font-bold text-slate-900 dark:text-white">{confirmation.type === 'unlink-google' ? t('confirmUnlinkGoogleTitle') : t('confirmRemovePasskeyTitle')}</h4>
                        <p id="security-confirm-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{confirmation.type === 'unlink-google' ? t('confirmUnlinkGoogleDescription') : t('confirmRemovePasskeyDescription')}</p>
                        <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                            <button ref={cancelConfirmationRef} type="button" disabled={busy} onClick={() => setConfirmation(null)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{t('cancel')}</button>
                            <button type="button" disabled={busy} onClick={confirmSensitiveAction} className="min-h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50">{busy ? t('processing') : confirmation.type === 'unlink-google' ? t('unlinkGoogle') : t('removePasskey')}</button>
                        </div>
                    </section>
                </div>
            )}
        </section>
    );
}
