import { useCallback, useEffect, useRef, useState } from 'react';
import { Fingerprint, Link2, Trash2, Unlink } from 'lucide-react';
import {
    beginPasskeyRegistrationApi, finishPasskeyRegistrationApi, listPasskeysApi,
    deletePasskeyApi, linkGoogleApi, getGoogleLinkApi, unlinkGoogleApi
} from '@/api/authApi.js';

const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export default function AdvancedSecurityMethods() {
    const [credentials, setCredentials] = useState([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [googleLink, setGoogleLink] = useState(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const googleButtonRef = useRef(null);
    const refresh = useCallback(async () => {
        try {
            const [passkeys, linkedGoogle] = await Promise.all([listPasskeysApi(), getGoogleLinkApi()]);
            setCredentials(passkeys);
            setGoogleLink(linkedGoogle);
        } catch (error) { setMessage(error.response?.data?.message || 'Không tải được phương thức bảo mật.'); }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId || !googleButtonRef.current) return undefined;
        let cancelled = false;
        const initialize = () => {
            if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
            window.google.accounts.id.initialize({
                client_id: clientId,
                auto_select: false,
                callback: async response => {
                    if (!response?.credential) return;
                    setBusy(true);
                    setMessage('');
                    try {
                        await linkGoogleApi(response.credential);
                        setMessage('Đã liên kết Google với tài khoản hiện tại.');
                        await refresh();
                    } catch (error) {
                        setMessage(error.response?.data?.message || 'Không thể liên kết Google.');
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
        return () => { cancelled = true; };
    }, []);

    const registerPasskey = async () => {
        setBusy(true);
        setMessage('');
        try {
            if (!window.isSecureContext || !navigator.credentials?.create) {
                throw new Error('Passkey cần trình duyệt hỗ trợ và HTTPS (localhost được phép khi phát triển).');
            }
            const { challengeId, options } = await beginPasskeyRegistrationApi();
            const publicKey = {
                ...options,
                challenge: decode(options.challenge),
                user: { ...options.user, id: decode(options.user.id) },
                excludeCredentials: (options.excludeCredentials || []).map(item => ({ ...item, id: decode(item.id) }))
            };
            const credential = await navigator.credentials.create({ publicKey });
            if (!credential) throw new Error('Bạn đã hủy đăng ký passkey.');
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
            setMessage('Đăng ký passkey thành công.');
            await refresh();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || 'Đăng ký passkey thất bại.');
        } finally { setBusy(false); }
    };

    const unlinkGoogle = async () => {
        if (!currentPassword) {
            setMessage('Nhập mật khẩu Student Manager để xác nhận gỡ liên kết Google.');
            return;
        }
        if (!window.confirm('Gỡ liên kết Google khỏi tài khoản hiện tại?')) return;
        setBusy(true);
        setMessage('');
        try {
            await unlinkGoogleApi(currentPassword);
            setGoogleLink(null);
            setCurrentPassword('');
            setMessage('Đã gỡ liên kết Google. Bạn vẫn có thể đăng nhập bằng username và mật khẩu.');
        } catch (error) {
            setMessage(error.response?.data?.message || 'Không thể gỡ liên kết Google.');
        } finally { setBusy(false); }
    };

    const removePasskey = async id => {
        if (!window.confirm('Xóa passkey này khỏi tài khoản?')) return;
        setBusy(true);
        setMessage('');
        try {
            await deletePasskeyApi(id);
            setMessage('Đã xóa passkey.');
            await refresh();
        } catch (error) {
            setMessage(error.response?.data?.message || 'Không thể xóa passkey.');
        } finally { setBusy(false); }
    };

    return (
        <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
                <Fingerprint size={19} className="text-blue-600" />
                <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">Passkey và tài khoản Google</h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Passkey xác thực trên thiết bị của bạn; máy chủ chỉ lưu khóa công khai. Google chỉ liên kết sau khi bạn xác thực trong phiên tài khoản hiện tại.
            </p>
            <button type="button" disabled={busy} onClick={registerPasskey} className="mb-4 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                <Fingerprint size={16} /> Thêm passkey
            </button>
            <div className="mb-4 space-y-2">
                {credentials.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                        <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{item.device_name || 'Passkey'}</p>
                            <p className="m-0 mt-1 text-[11px] text-slate-400">Đăng ký: {new Date(item.created_at).toLocaleString()}</p>
                        </div>
                        <button type="button" disabled={busy} onClick={() => removePasskey(item.id)} aria-label="Xóa passkey" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/30"><Trash2 size={16} /></button>
                    </div>
                ))}
                {!credentials.length && <p className="text-xs text-slate-400">Chưa có passkey hoặc chưa tải được danh sách.</p>}
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><Link2 size={15} /> Liên kết Google</div>
            <div ref={googleButtonRef} className={googleLink ? 'hidden' : ''} />
            {googleLink ? (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <p className="m-0 text-sm font-medium text-slate-800 dark:text-slate-100">Đã liên kết Google</p>
                    <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{googleLink.provider_email || 'Tài khoản Google đã liên kết'}</p>
                    <label className="block text-xs text-slate-600 dark:text-slate-300" htmlFor="unlink-google-password">Nhập mật khẩu Student Manager để gỡ liên kết</label>
                    <input id="unlink-google-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                    <button type="button" disabled={busy || !currentPassword} onClick={unlinkGoogle} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"><Unlink size={14} /> Gỡ liên kết Google</button>
                </div>
            ) : null}
            {!googleLink && !import.meta.env.VITE_GOOGLE_CLIENT_ID && <p className="mt-2 text-xs text-slate-400">Cần cấu hình VITE_GOOGLE_CLIENT_ID trong môi trường frontend.</p>}
            {message && <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{message}</p>}
        </section>
    );
}
