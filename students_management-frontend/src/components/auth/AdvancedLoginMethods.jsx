import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { googleLoginApi } from '@/api/authApi.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function AdvancedLoginMethods({ onLogin, onError, onLoading }) {
    const { t } = useLanguage();
    const googleButtonRef = useRef(null);
    const callbacksRef = useRef({ onLogin, onError, onLoading });
    callbacksRef.current = { onLogin, onError, onLoading };
    const [googleReady, setGoogleReady] = useState(false);
    const [googleLoadError, setGoogleLoadError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId || !googleButtonRef.current) return undefined;

        let cancelled = false;
        let script = document.querySelector('script[data-google-identity]');
        let createdScript = false;

        const handleScriptError = () => {
            if (!cancelled) setGoogleLoadError(t('googleServiceLoadFailed'));
        };

        const initialize = () => {
            if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;

            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async result => {
                    if (!result?.credential) {
                        callbacksRef.current.onError(t('googleMissingCredential'));
                        return;
                    }

                    setBusy(true);
                    callbacksRef.current.onLoading(true);
                    callbacksRef.current.onError('');

                    try {
                        const data = await googleLoginApi(result.credential);
                        callbacksRef.current.onLogin(data);
                    } catch (error) {
                        callbacksRef.current.onError(error.response?.data?.message || t('googleLoginFailed'));
                    } finally {
                        setBusy(false);
                        callbacksRef.current.onLoading(false);
                    }
                },
                auto_select: false
            });

            window.google.accounts.id.renderButton(googleButtonRef.current, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                width: Math.min(320, Math.max(200, googleButtonRef.current.parentElement?.clientWidth || 320)),
                logo_alignment: 'left'
            });
            setGoogleLoadError('');
            setGoogleReady(true);
        };

        if (window.google?.accounts?.id) {
            initialize();
        } else {
            if (!script) {
                script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.dataset.googleIdentity = 'true';
                document.head.appendChild(script);
                createdScript = true;
            }
            script.addEventListener('load', initialize);
            script.addEventListener('error', handleScriptError);
        }

        return () => {
            cancelled = true;
            script?.removeEventListener('load', initialize);
            script?.removeEventListener('error', handleScriptError);
            // Do not remove a shared Google Identity Services script; other
            // authenticated pages may rely on it.
            if (createdScript && script && !script.isConnected) script = null;
        };
    }, []);

    return (
        <div className="mt-4 space-y-3">
            <div className="relative flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="whitespace-nowrap">Hoặc tiếp tục bằng</span>
                <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="flex min-h-11 w-full justify-center overflow-hidden" aria-label="Đăng nhập bằng Google">
                <div ref={googleButtonRef} className={busy ? 'pointer-events-none opacity-60' : ''} />
            </div>

            {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <p className="text-center text-xs text-slate-400">
                    <ShieldCheck className="mr-1 inline" size={14} />
                    Đăng nhập Google chỉ dùng được khi ứng dụng đã được cấu hình OAuth.
                </p>
            )}
            {googleLoadError && (
                <p role="status" aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-xs leading-5 text-amber-800">
                    {googleLoadError}
                </p>
            )}
            {!googleReady && !googleLoadError && import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <p role="status" aria-live="polite" className="text-center text-xs text-slate-400">Đang tải Google Identity Services…</p>
            )}
        </div>
    );
}
