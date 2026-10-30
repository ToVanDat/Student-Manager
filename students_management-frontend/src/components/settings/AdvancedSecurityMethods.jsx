import { useCallback, useEffect, useRef, useState } from 'react';
import { Fingerprint, Link2, Trash2, Unlink, ShieldCheck } from 'lucide-react';
import FaceLoginSettings from './FaceLoginSettings.jsx';
import {
    beginPasskeyRegistrationApi, finishPasskeyRegistrationApi, listPasskeysApi,
    deletePasskeyApi, linkGoogleApi, getGoogleLinkApi, unlinkGoogleApi,
    beginSensitiveReauthApi, finishSensitiveReauthApi, getBiometricLoginStatusApi
} from '@/api/authApi.js';

const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export default function AdvancedSecurityMethods() {
    const [credentials, setCredentials] = useState([]);
    const [biometricStatus, setBiometricStatus] = useState(null);
    const [passkeysLoading, setPasskeysLoading] = useState(true);
    const [passkeysError, setPasskeysError] = useState('');
    const [googleStatusLoading, setGoogleStatusLoading] = useState(true);
    const [googleStatusError, setGoogleStatusError] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
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
        const errors = [];

        if (passkeysResult.status === 'fulfilled') {
            setCredentials(passkeysResult.value);
        } else {
            setPasskeysError(passkeysResult.reason?.response?.data?.message || 'Không tải được danh sách passkey. Kiểm tra đăng nhập và bảng user_webauthn_credentials.');
        }

        if (biometricResult.status === 'fulfilled') {
            setBiometricStatus(biometricResult.value);
        } else {
            setBiometricStatus(null);
        }

        if (googleResult.status === 'fulfilled') {
            setGoogleLink(googleResult.value);
        } else {
            setGoogleStatusError(googleResult.reason?.response?.data?.message || 'Không tải được trạng thái liên kết Google.');
        }

        setPasskeysLoading(false);
        setGoogleStatusLoading(false);
    }, []);

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
                        setMessage('Hãy xác minh bằng mật khẩu Student Manager hoặc nhấn “Xác minh bằng passkey” trước khi liên kết Google.');
                        return;
                    }
                    setBusy(true);
                    setMessage('');
                    try {
                        await linkGoogleApi(response.credential, currentPasswordRef.current || undefined, verificationTokenRef.current || undefined);
                        setCurrentPassword('');
                        setVerificationToken('');
                        setMessage('Đã xác minh tài khoản và liên kết Google thành công.');
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

    const verifyWithPasskey = async purpose => {
        setBusy(true);
        setMessage('');
        try {
            if (!window.isSecureContext || !navigator.credentials?.get) throw new Error('Passkey cần trình duyệt hỗ trợ và HTTPS (localhost được phép khi phát triển).');
            const { challengeId, options } = await beginSensitiveReauthApi(purpose);
            const publicKey = {
                ...options,
                challenge: decode(options.challenge),
                allowCredentials: (options.allowCredentials || []).map(item => ({ ...item, id: decode(item.id) }))
            };
            const credential = await navigator.credentials.get({ publicKey });
            if (!credential) throw new Error('Bạn đã hủy xác minh passkey.');
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
            setMessage('Đã xác minh bằng passkey. Tiếp tục liên kết hoặc gỡ liên kết Google trong 5 phút.');
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || 'Xác minh passkey thất bại.');
        } finally { setBusy(false); }
    };

    const unlinkGoogle = async () => {
        if (!currentPassword && !verificationToken) {
            setMessage('Hãy xác minh bằng mật khẩu Student Manager hoặc passkey trước khi gỡ liên kết Google.');
            return;
        }
        if (!window.confirm('Gỡ liên kết Google khỏi tài khoản hiện tại?')) return;
        setBusy(true);
        setMessage('');
        try {
            await unlinkGoogleApi(currentPassword || undefined, verificationToken || undefined);
            setCurrentPassword('');
            setVerificationToken('');
            setMessage('Đã gỡ liên kết Google.');
            await refresh();
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
            <FaceLoginSettings />
            <div className="mb-3 flex items-center gap-2">
                <Fingerprint size={19} className="text-blue-600" />
                <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">Passkey (WebAuthn) và tài khoản Google</h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Passkey sử dụng WebAuthn để xác minh thiết bị. Tùy thiết bị và hệ điều hành, trình xác thực có thể yêu cầu Face ID, Windows Hello, vân tay, PIN hoặc phương thức khác. Student Manager không truy cập camera, không nhận ảnh khuôn mặt và không lưu dữ liệu sinh trắc học; máy chủ chỉ lưu thông tin credential và khóa công khai. Đây không phải tính năng nhận diện khuôn mặt riêng của Student Manager.
            </p>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200"><ShieldCheck size={15} /> Đăng nhập bằng Passkey (WebAuthn)</div>
                <span className={((biometricStatus?.configured ?? (credentials.length > 0))) ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300'}>{(biometricStatus?.configured ?? (credentials.length > 0)) ? `Đã đăng ký ${biometricStatus?.credentialCount ?? credentials.length} Passkey` : 'Chưa thiết lập'}</span>
            </div>
            <button type="button" disabled={busy} onClick={registerPasskey} className="mb-4 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                <Fingerprint size={16} /> {credentials.length ? 'Thêm Passkey' : 'Đăng ký Passkey trên thiết bị'}
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
                {passkeysLoading && <p role="status" className="text-xs text-slate-500">Đang tải danh sách passkey…</p>}
                {!passkeysLoading && passkeysError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{passkeysError}<button type="button" onClick={() => void refresh()} className="ml-2 font-semibold underline">Thử lại</button></div>}
                {!passkeysLoading && !passkeysError && !credentials.length && <p className="text-xs text-slate-400">Chưa có Passkey. Đăng ký một Passkey để đăng nhập bằng phương thức xác minh an toàn do thiết bị hỗ trợ.</p>}
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><Link2 size={15} /> Liên kết Google</div>
            {googleStatusLoading && <p role="status" className="text-xs text-slate-500">Đang kiểm tra trạng thái Google…</p>}
            {!googleStatusLoading && googleStatusError && <div role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{googleStatusError}<button type="button" onClick={() => void refresh()} className="ml-2 font-semibold underline">Thử lại</button></div>}
            {!googleStatusLoading && !googleStatusError && !googleLink && <div className="mb-3 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200" htmlFor="link-google-password">Xác minh bằng mật khẩu Student Manager</label>
                <input id="link-google-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder="Mật khẩu tài khoản hiện tại" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                <p className="m-0 text-xs leading-5 text-slate-500 dark:text-slate-400">Xác minh bằng mật khẩu hiện tại hoặc passkey. Sau đó, xác minh danh tính Google để hoàn tất liên kết.</p>
                <button type="button" disabled={busy} onClick={() => verifyWithPasskey('google-link')} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Fingerprint size={14} /> Xác minh bằng passkey</button>
                {verificationToken && <p className="m-0 text-xs text-emerald-700 dark:text-emerald-300">Đã xác minh bằng passkey. Bây giờ hãy tiếp tục với Google.</p>}
                <div ref={googleButtonRef} className={busy ? 'pointer-events-none opacity-50' : ''} />
            </div>}
            {!googleStatusLoading && !googleStatusError && googleLink ? (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <p className="m-0 text-sm font-medium text-slate-800 dark:text-slate-100">Đã liên kết Google</p>
                    <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{googleLink.provider_email || 'Tài khoản Google đã liên kết'}</p>
                    <label className="block text-xs text-slate-600 dark:text-slate-300" htmlFor="unlink-google-password">Xác minh bằng mật khẩu Student Manager hoặc passkey</label>
                    <input id="unlink-google-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                    <button type="button" disabled={busy || (!currentPassword && !verificationToken)} onClick={unlinkGoogle} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"><Unlink size={14} /> Gỡ liên kết Google</button>
                    <button type="button" disabled={busy} onClick={() => verifyWithPasskey('google-unlink')} className="ml-2 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><Fingerprint size={14} /> Xác minh bằng passkey</button>
                    {verificationToken && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">Đã xác minh bằng passkey.</p>}
                </div>
            ) : null}
            {!googleStatusLoading && !googleStatusError && !googleLink && !import.meta.env.VITE_GOOGLE_CLIENT_ID && <p className="mt-2 text-xs text-slate-400">Cần cấu hình VITE_GOOGLE_CLIENT_ID trong môi trường frontend.</p>}
            {message && <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{message}</p>}
        </section>
    );
}
