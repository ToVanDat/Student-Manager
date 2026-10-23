import { useCallback, useEffect, useRef, useState } from 'react';
import { LockKeyhole, ShieldCheck, UnlockKeyhole } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.js';
import { shutdownE2EEClient } from '@/services/e2ee/e2eeClient.js';
import {
    lockPinProtectedE2EEVault,
    unlockPinProtectedE2EEVault,
    removePinProtectionFromE2EEVault,
    cancelPinProtectedE2EEVaultSetup
} from '@/services/e2ee/pinProtectedE2EEVault.js';

const LEGACY_PIN_KEY = 'student-manager:chat-lock:v1';
const LEGACY_LOCK_KEY = 'student-manager:chat-lock:locked';
const LEGACY_FAILURE_KEY = 'student-manager:chat-lock:failures';
const pinKeyForUser = userId => `student-manager:chat-lock:v2:${userId}`;
const lockKeyForUser = userId => `student-manager:chat-lock:locked:v2:${userId}`;
const failureKeyForUser = userId => `student-manager:chat-lock:failures:v2:${userId}`;
const IDLE_MS = 5 * 60 * 1000;
const MIN_PIN = 6;
const MAX_PIN = 12;

const readJson = (key, fallback) => {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
};

const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

async function derivePin(pin, salt) {
    const material = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
    );
    return crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
        material, 256
    );
}

async function makePinRecord(pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const digest = await derivePin(pin, salt);
    return { version: 1, salt: toBase64(salt), digest: toBase64(digest) };
}

async function matchesPin(pin, record) {
    const digest = new Uint8Array(await derivePin(pin, fromBase64(record.salt)));
    const expected = fromBase64(record.digest);
    if (digest.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < digest.length; i += 1) difference |= digest[i] ^ expected[i];
    return difference === 0;
}

export default function ChatLockGate({ children }) {
    const { user } = useAuth();
    const userId = user?.id == null ? null : String(user.id);
    const [record, setRecord] = useState(null);
    const [recordOwnerId, setRecordOwnerId] = useState(null);
    const [legacyRecord, setLegacyRecord] = useState(null);
    const [confirmLegacyOwnership, setConfirmLegacyOwnership] = useState(false);
    const [locked, setLocked] = useState(false);
    const [mode, setMode] = useState('unlock');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [remainingMs, setRemainingMs] = useState(0);
    const idleTimer = useRef(null);
    const cooldownTimer = useRef(null);

    const ownsCurrentRecord = Boolean(userId && recordOwnerId === userId);
    const currentRecord = ownsCurrentRecord ? record : null;
    const failures = () => readJson(failureKeyForUser(userId), { count: 0, until: 0 });

    useEffect(() => {
        if (!userId) {
            setRecord(null); setRecordOwnerId(null); setLegacyRecord(null); setLocked(false); setMode('unlock');
            return;
        }
        const scopedRecord = readJson(pinKeyForUser(userId), null);
        setRecord(scopedRecord); setRecordOwnerId(userId);
        setLocked(Boolean(scopedRecord && sessionStorage.getItem(lockKeyForUser(userId)) === 'true'));
        setLegacyRecord(scopedRecord ? null : readJson(LEGACY_PIN_KEY, null));
        setConfirmLegacyOwnership(false); setPin(''); setConfirmPin(''); setError(''); setRemainingMs(0); setMode('unlock');
    }, [userId]);

    const lock = useCallback(() => {
        if (!currentRecord || !userId) return;
        void shutdownE2EEClient().finally(() => lockPinProtectedE2EEVault(userId));
        sessionStorage.setItem(lockKeyForUser(userId), 'true');
        setLocked(true);
        setMode('unlock');
        setPin('');
        setConfirmPin('');
        setError('');
    }, [currentRecord, userId]);

    const scheduleIdleLock = useCallback(() => {
        if (!currentRecord || locked) return;
        window.clearTimeout(idleTimer.current);
        idleTimer.current = window.setTimeout(lock, IDLE_MS);
    }, [currentRecord, locked, lock]);

    useEffect(() => {
        if (!currentRecord || locked) return undefined;
        const activity = () => {
            if (document.visibilityState === 'hidden') lock();
            else scheduleIdleLock();
        };
        const events = ['pointerdown', 'keydown', 'touchstart'];
        events.forEach(event => window.addEventListener(event, activity, { passive: true }));
        // visibilitychange is dispatched on document, not window.
        document.addEventListener('visibilitychange', activity);
        scheduleIdleLock();
        return () => {
            events.forEach(event => window.removeEventListener(event, activity));
            document.removeEventListener('visibilitychange', activity);
            window.clearTimeout(idleTimer.current);
        };
    }, [currentRecord, locked, scheduleIdleLock, lock]);

    useEffect(() => () => {
        window.clearTimeout(idleTimer.current);
        window.clearInterval(cooldownTimer.current);
    }, []);

    useEffect(() => {
        if (remainingMs <= 0) return undefined;
        cooldownTimer.current = window.setInterval(() => {
            setRemainingMs(value => Math.max(0, value - 1000));
        }, 1000);
        return () => window.clearInterval(cooldownTimer.current);
    }, [remainingMs > 0]);

    const submit = async event => {
        event.preventDefault();
        setError('');
        if (!/^[0-9]{6,12}$/.test(pin)) {
            setError('PIN phải gồm từ 6 đến 12 chữ số.');
            return;
        }
        setBusy(true);
        try {
            if (mode === 'setup') {
                if (pin !== confirmPin) {
                    setError('Hai lần nhập PIN không khớp.');
                    return;
                }
                if (!userId) {
                    setError('Đăng nhập lại để thiết lập PIN bảo vệ khóa E2EE trên tài khoản này.');
                    return;
                }
                await unlockPinProtectedE2EEVault(userId, pin);
                const next = await makePinRecord(pin);
                localStorage.setItem(pinKeyForUser(userId), JSON.stringify(next));
                sessionStorage.removeItem(lockKeyForUser(userId));
                setRecord(next); setRecordOwnerId(userId); setLegacyRecord(null);
                setLocked(false);
                setMode('unlock');
                setPin('');
                setConfirmPin('');
                return;
            }

            if (mode === 'migrateLegacy') {
                if (!legacyRecord || !confirmLegacyOwnership) { setError('Xác nhận tài khoản sở hữu PIN cũ trước khi chuyển.'); return; }
                if (!(await matchesPin(pin, legacyRecord))) { setError('PIN cũ không đúng. Cấu hình cũ vẫn được giữ nguyên.'); return; }
                if (!userId) { setError('Hãy đăng nhập vào đúng tài khoản sở hữu PIN cũ.'); return; }
                // Prove this PIN opens existing E2EE material before claiming the legacy PIN.
                await unlockPinProtectedE2EEVault(userId, pin);
                localStorage.setItem(pinKeyForUser(userId), JSON.stringify(legacyRecord));
                localStorage.removeItem(LEGACY_PIN_KEY); localStorage.removeItem(LEGACY_FAILURE_KEY);
                sessionStorage.removeItem(LEGACY_LOCK_KEY); sessionStorage.removeItem(lockKeyForUser(userId));
                setRecord(legacyRecord); setRecordOwnerId(userId); setLegacyRecord(null); setLocked(false);
                setMode('unlock'); setPin(''); setConfirmLegacyOwnership(false); setRemainingMs(0); return;
            }
            const failure = failures();
            if (failure.until > Date.now()) {
                setRemainingMs(failure.until - Date.now());
                setError('Bạn đã nhập sai quá nhiều lần. Vui lòng chờ trước khi thử lại.');
                return;
            }
            if (!currentRecord || !(await matchesPin(pin, currentRecord))) {
                const nextCount = failure.count + 1;
                const delay = nextCount >= 10 ? 15 * 60_000
                    : nextCount >= 7 ? 5 * 60_000
                    : nextCount >= 5 ? 60_000 : 0;
                const next = { count: nextCount, until: delay ? Date.now() + delay : 0 };
                localStorage.setItem(failureKeyForUser(userId), JSON.stringify(next));
                setRemainingMs(delay);
                setError(delay ? 'Đã vượt quá số lần thử. Hãy đợi rồi thử lại.' : 'PIN không đúng.');
                return;
            }
            if (!userId) {
                setError('Đăng nhập lại để mở khóa kho E2EE của tài khoản này.');
                return;
            }
            await unlockPinProtectedE2EEVault(userId, pin);
            localStorage.removeItem(failureKeyForUser(userId));
            sessionStorage.removeItem(lockKeyForUser(userId));
            setLocked(false);
            setPin('');
            setRemainingMs(0);
            scheduleIdleLock();
        } catch {
            setError('Không thể xác minh PIN trên thiết bị này. Hãy kiểm tra trình duyệt có hỗ trợ Web Crypto hay không.');
        } finally {
            setBusy(false);
        }
    };

    const removePin = async () => {
        if (!window.confirm('Tắt PIN khóa chat và chuyển khóa E2EE về kho mặc định của trình duyệt này?')) return;
        if (!userId) {
            setError('Không xác định được tài khoản hiện tại.');
            return;
        }
        setBusy(true);
        try {
            await shutdownE2EEClient();
            await removePinProtectionFromE2EEVault(userId);
            lockPinProtectedE2EEVault(userId);
        } catch (error) {
            setError(error?.message || 'Không thể gỡ bảo vệ PIN khỏi kho khóa E2EE.');
            setBusy(false);
            return;
        }
        localStorage.removeItem(pinKeyForUser(userId));
        localStorage.removeItem(failureKeyForUser(userId));
        sessionStorage.removeItem(lockKeyForUser(userId));
        setRecord(null); setRecordOwnerId(null);
        setLocked(false);
        setMode('unlock');
        setPin('');
        setConfirmPin('');
        setBusy(false);
    };

    const cancelSetup = async () => {
        setBusy(true);
        try {
            if (userId) await cancelPinProtectedE2EEVaultSetup(userId);
            setMode('unlock');
            setPin('');
            setConfirmPin('');
            setError('');
        } catch (error) {
            setError(error?.message || 'Không thể hủy thiết lập PIN an toàn.');
        } finally {
            setBusy(false);
        }
    };

    const openSetup = async () => {
        setBusy(true);
        try {
            await shutdownE2EEClient();
            lockPinProtectedE2EEVault(userId);
        } catch (error) {
            setError(error?.message || 'Không thể khóa kho E2EE trước khi thiết lập PIN.');
            setBusy(false);
            return;
        }
        setBusy(false);
        setMode('setup');
        setPin('');
        setConfirmPin('');
        setError('');
    };

    if (!userId) return children;

    if (currentRecord && !locked) {
        return (
            <div className="relative min-h-0 h-full">
                {children}
                <button
                    type="button"
                    onClick={lock}
                    title="Khóa chat ngay"
                    aria-label="Khóa chat ngay"
                    className="fixed bottom-4 right-4 z-[100] flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                    <LockKeyhole size={18} />
                </button>
                <button
                    type="button"
                    onClick={removePin}
                    title="Tắt PIN khóa chat"
                    aria-label="Tắt PIN khóa chat"
                    className="fixed bottom-4 right-16 z-[100] flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                    <UnlockKeyhole size={18} />
                </button>
            </div>
        );
    }

    if (!currentRecord && mode !== 'setup' && mode !== 'migrateLegacy') {
        return (
            <>
                {children}
                <button
                    type="button"
                    onClick={openSetup}
                    title="Thiết lập PIN khóa chat"
                    aria-label="Thiết lập PIN khóa chat"
                    className="fixed bottom-4 right-4 z-[100] flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                    <ShieldCheck size={18} />
                </button>
            </>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="chat-lock-title">
            <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {mode === 'setup' ? <ShieldCheck size={26} /> : <LockKeyhole size={26} />}
                </div>
                <h2 id="chat-lock-title" className="text-center text-xl font-bold text-slate-900 dark:text-white">
                    {mode === 'setup' ? 'Thiết lập PIN khóa chat' : mode === 'migrateLegacy' ? 'Chuyển PIN cũ sang tài khoản này' : 'Chat đang được khóa'}
                </h2>
                <p className="mb-5 mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                    {mode === 'setup'
                        ? 'PIN dẫn xuất khóa PBKDF2 để bọc khóa cơ sở dữ liệu E2EE bằng AES-GCM. PIN không thay thế mật khẩu tài khoản.'
                        : mode === 'migrateLegacy'
                            ? 'Chỉ chuyển PIN nếu đây đúng là tài khoản đã thiết lập PIN cũ. PIN chỉ được chuyển sau khi xác minh và mở được kho E2EE hiện có.'
                            : 'Nhập PIN để mở lại nội dung chat. Phiên đăng nhập và lịch sử tin nhắn vẫn được giữ nguyên.'}
                </p>
                <label htmlFor="chat-lock-pin" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">PIN (6–12 chữ số)</label>
                <input
                    id="chat-lock-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{6,12}"
                    minLength={MIN_PIN}
                    maxLength={MAX_PIN}
                    autoComplete="off"
                    autoFocus
                    required
                    value={pin}
                    onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, MAX_PIN))}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-xl tracking-[0.4em] text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                {mode === 'migrateLegacy' && (
                    <label className="mt-3 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input type="checkbox" checked={confirmLegacyOwnership} onChange={event => setConfirmLegacyOwnership(event.target.checked)} className="mt-1" />
                        <span>Tôi xác nhận đây là tài khoản đã sở hữu PIN cũ và kho khóa E2EE liên quan.</span>
                    </label>
                )}
                {mode === 'setup' && (
                    <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Nhập lại PIN
                        <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="off"
                            required
                            value={confirmPin}
                            onChange={event => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, MAX_PIN))}
                            className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-xl tracking-[0.4em] text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                    </label>
                )}
                {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}{remainingMs > 0 ? ` (còn ${Math.ceil(remainingMs / 1000)} giây)` : ''}</p>}
                <button type="submit" disabled={busy} className="mt-4 h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                    {busy ? 'Đang xác minh…' : mode === 'setup' ? 'Lưu PIN' : mode === 'migrateLegacy' ? 'Xác minh và chuyển PIN cũ' : 'Mở khóa chat'}
                </button>
                {mode === 'migrateLegacy' && (
                    <button type="button" onClick={() => { setMode('unlock'); setPin(''); setConfirmLegacyOwnership(false); setError(''); }} disabled={busy} className="mt-2 h-10 w-full rounded-xl text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Hủy chuyển PIN cũ</button>
                )}
                {mode === 'setup' && (
                    <button type="button" onClick={cancelSetup} disabled={busy} className="mt-2 h-10 w-full rounded-xl text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">Hủy</button>
                )}
                {legacyRecord && !currentRecord && mode === 'unlock' && (
                    <button type="button" onClick={() => { setMode('migrateLegacy'); setPin(''); setError(''); }} className="mt-2 h-10 w-full rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800">Chuyển PIN cũ sang tài khoản này…</button>
                )}
            </form>
        </div>
    );
}
