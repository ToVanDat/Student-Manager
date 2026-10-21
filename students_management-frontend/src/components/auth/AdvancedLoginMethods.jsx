import { useEffect, useRef, useState } from 'react';
import { Fingerprint, ShieldCheck } from 'lucide-react';
import { beginPasskeyLoginApi, finishPasskeyLoginApi, googleLoginApi } from '@/api/authApi.js';

const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const serializeCredential = credential => ({
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
});

export default function AdvancedLoginMethods({ username, onLogin, onError, onLoading }) {
    const googleButtonRef = useRef(null);
    const [googleReady, setGoogleReady] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId || !googleButtonRef.current) return undefined;
        let cancelled = false;
        const initialize = () => {
            if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async result => {
                    if (!result?.credential) return onError('Google không trả về ID token.');
                    setBusy(true);
                    onLoading(true);
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
                type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
                shape: 'rectangular', width: 320, logo_alignment: 'left'
            });
            setGoogleReady(true);
        };
        if (window.google?.accounts?.id) {
            initialize();
        } else {
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
        };
    }, [onError, onLoading, onLogin]);

    const loginWithPasskey = async () => {
        onError('');
        if (!username.trim()) {
            onError('Nhập username trước khi đăng nhập bằng passkey.');
            return;
        }
        if (!window.isSecureContext || !navigator.credentials?.get) {
            onError('Trình duyệt hoặc kết nối hiện tại không hỗ trợ passkey. Hãy dùng đăng nhập mật khẩu.');
            return;
        }
        setBusy(true);
        onLoading(true);
        try {
            const { challengeId, options } = await beginPasskeyLoginApi(username.trim());
            const publicKey = {
                ...options,
                challenge: decode(options.challenge),
                allowCredentials: (options.allowCredentials || []).map(item => ({
                    ...item,
                    id: decode(item.id)
                }))
            };
            const credential = await navigator.credentials.get({ publicKey });
            if (!credential) throw new Error('Bạn đã hủy xác thực passkey.');
            const data = await finishPasskeyLoginApi(challengeId, serializeCredential(credential));
            onLogin(data);
        } catch (error) {
            onError(error.response?.data?.message || error.message || 'Đăng nhập passkey thất bại.');
        } finally {
            setBusy(false);
            onLoading(false);
        }
    };

    return (
        <div className="mt-4 space-y-3">
            <div className="relative flex items-center gap-3 text-[11px] text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>Hoặc đăng nhập bằng</span>
                <span className="h-px flex-1 bg-slate-200" />
            </div>
            <button type="button" onClick={loginWithPasskey} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <Fingerprint size={18} /> Đăng nhập bằng passkey
            </button>
            <div className="flex justify-center" aria-label="Đăng nhập bằng Google">
                <div ref={googleButtonRef} />
            </div>
            {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <p className="text-center text-xs text-slate-400"><ShieldCheck className="mr-1 inline" size={14} />Cần cấu hình VITE_GOOGLE_CLIENT_ID để bật Google Login.</p>
            )}
            {!googleReady && import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <p className="text-center text-xs text-slate-400">Đang tải Google Identity Services…</p>
            )}
        </div>
    );
}
