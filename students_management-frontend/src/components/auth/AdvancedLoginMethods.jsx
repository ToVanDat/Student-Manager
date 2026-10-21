import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { googleLoginApi } from '@/api/authApi.js';

export default function AdvancedLoginMethods({ onLogin, onError, onLoading }) {
    const googleButtonRef = useRef(null);
    const [googleReady, setGoogleReady] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId || !googleButtonRef.current) return undefined;

        let cancelled = false;
        let script = document.querySelector('script[data-google-identity]');
        let createdScript = false;

        const initialize = () => {
            if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;

            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async result => {
                    if (!result?.credential) {
                        onError('Google không trả về ID token.');
                        return;
                    }

                    setBusy(true);
                    onLoading(true);
                    onError('');

                    try {
                        const data = await googleLoginApi(result.credential);
                        onLogin(data);
                    } catch (error) {
                        onError(error.response?.data?.message || 'Đăng nhập Google thất bại.');
                    } finally {
                        setBusy(false);
                        onLoading(false);
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
        }

        return () => {
            cancelled = true;
            script?.removeEventListener('load', initialize);
            // Do not remove a shared Google Identity Services script; other
            // authenticated pages may rely on it.
            if (createdScript && script && !script.isConnected) script = null;
        };
    }, [onError, onLoading, onLogin]);

    return (
        <div className="mt-5 space-y-3.5">
            <div className="relative flex items-center gap-3 text-[11px] text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="whitespace-nowrap">Hoặc đăng nhập bằng</span>
                <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="flex min-h-11 w-full justify-center overflow-hidden" aria-label="Đăng nhập bằng Google">
                <div ref={googleButtonRef} className={busy ? 'pointer-events-none opacity-60' : ''} />
            </div>

            {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <p className="text-center text-xs text-slate-400">
                    <ShieldCheck className="mr-1 inline" size={14} />
                    Cần cấu hình VITE_GOOGLE_CLIENT_ID để bật Google Login.
                </p>
            )}
            {!googleReady && import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <p className="text-center text-xs text-slate-400">Đang tải Google Identity Services…</p>
            )}
        </div>
    );
}
