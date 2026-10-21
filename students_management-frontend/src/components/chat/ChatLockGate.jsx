import { useCallback, useEffect, useRef, useState } from 'react';
import { LockKeyhole, ShieldCheck, UnlockKeyhole } from 'lucide-react';

const PIN_KEY = 'student-manager:chat-lock:v1';
const LOCK_KEY = 'student-manager:chat-lock:locked';
const FAILURE_KEY = 'student-manager:chat-lock:failures';
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
    const [record, setRecord] = useState(() => readJson(PIN_KEY, null));
    const [locked, setLocked] = useState(() => Boolean(readJson(PIN_KEY, null)));
    const [mode, setMode] = useState('unlock');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [remainingMs, setRemainingMs] = useState(0);
    const idleTimer = useRef(null);
    const cooldownTimer = useRef(null);

    const failures = () => readJson(FAILURE_KEY, { count: 0, until: 0 });

    const lock = useCallback(() => {
        if (!record) return;
        sessionStorage.setItem(LOCK_KEY, 'true');
        setLocked(true);
        setMode('unlock');
        setPin('');
        setConfirmPin('');
        setError('');
    }, [record]);

    const scheduleIdleLock = useCallback(() => {
        if (!record || locked) return;
        window.clearTimeout(idleTimer.current);
        idleTimer.current = window.setTimeout(lock, IDLE_MS);
    }, [record, locked, lock]);

    useEffect(() => {
        if (!record || locked) return undefined;
        const activity = () => {
            if (document.visibilityState === 'hidden') lock();
            else scheduleIdleLock();
        };
        const events = ['pointerdown', 'keydown', 'touchstart', 'visibilitychange'];
        events.forEach(event => window.addEventListener(event, activity, { passive: true }));
        scheduleIdleLock();
        return () => {
            events.forEach(event => window.removeEventListener(event, activity));
            window.clearTimeout(idleTimer.current);
        };
    }, [record, locked, scheduleIdleLock, lock]);

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
                const next = await makePinRecord(pin);
                localStorage.setItem(PIN_KEY, JSON.stringify(next));
                sessionStorage.removeItem(LOCK_KEY);
                setRecord(next);
                setLocked(false);
                setMode('unlock');
                setPin('');
                setConfirmPin('');
                return;
            }

            const failure = failures();
            if (failure.until > Date.now()) {
                setRemainingMs(failure.until - Date.now());
                setError('Bạn đã nhập sai quá nhiều lần. Vui lòng chờ trước khi thử lại.');
                return;
            }
            if (!record || !(await matchesPin(pin, record))) {
                const nextCount = failure.count + 1;
                const delay = nextCount >= 10 ? 15 * 60_000
                    : nextCount >= 7 ? 5 * 60_000
                    : nextCount >= 5 ? 60_000 : 0;
                const next = { count: nextCount, until: delay ? Date.now() + delay : 0 };
                localStorage.setItem(FAILURE_KEY, JSON.stringify(next));
                setRemainingMs(delay);
                setError(delay ? 'Đã vượt quá số lần thử. Hãy đợi rồi thử lại.' : 'PIN không đúng.');
                return;
            }
            localStorage.removeItem(FAILURE_KEY);
            sessionStorage.removeItem(LOCK_KEY);
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

    const removePin = () => {
        if (!window.confirm('Tắt PIN khóa chat trên trình duyệt này?')) return;
        localStorage.removeItem(PIN_KEY);
        localStorage.removeItem(FAILURE_KEY);
        sessionStorage.removeItem(LOCK_KEY);
        setRecord(null);
        setLocked(false);
        setMode('unlock');
        setPin('');
        setConfirmPin('');
    };

    const openSetup = () => {
        setMode('setup');
        setPin('');
        setConfirmPin('');
        setError('');
    };

    if (record && !locked) {
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

    if (!record && mode !== 'setup') {
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
                    {mode === 'setup' ? 'Thiết lập PIN khóa chat' : 'Chat đang được khóa'}
                </h2>
                <p className="mb-5 mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                    {mode === 'setup'
                        ? 'PIN chỉ khóa giao diện chat trên trình duyệt này; không thay thế mật khẩu tài khoản.'
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
                    {busy ? 'Đang xác minh…' : mode === 'setup' ? 'Lưu PIN' : 'Mở khóa chat'}
                </button>
                {mode === 'setup' && (
                    <button type="button" onClick={() => setMode('unlock')} className="mt-2 h-10 w-full rounded-xl text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Hủy</button>
                )}
            </form>
        </div>
    );
}
