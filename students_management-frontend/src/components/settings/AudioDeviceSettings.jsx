import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, CheckCircle2, Mic, MicOff, RefreshCw, Volume2 } from 'lucide-react';

const MIC_KEY = 'student-manager-preferred-microphone';
const OUTPUT_KEY = 'student-manager-preferred-audio-output';

export default function AudioDeviceSettings() {
    const [devices, setDevices] = useState([]);
    const [microphoneId, setMicrophoneId] = useState(() => {
        try { return localStorage.getItem(MIC_KEY) || ''; } catch { return ''; }
    });
    const [outputId, setOutputId] = useState(() => {
        try { return localStorage.getItem(OUTPUT_KEY) || ''; } catch { return ''; }
    });
    const [testing, setTesting] = useState(false);
    const [level, setLevel] = useState(0);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const streamRef = useRef(null);
    const audioContextRef = useRef(null);
    const frameRef = useRef(null);

    const stopTest = useCallback(() => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        void audioContextRef.current?.close?.();
        audioContextRef.current = null;
        setTesting(false);
        setLevel(0);
    }, []);

    const refreshDevices = useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) {
            setError('Trình duyệt không hỗ trợ danh sách thiết bị âm thanh. Hãy dùng HTTPS hoặc localhost.');
            return;
        }
        try {
            const all = await navigator.mediaDevices.enumerateDevices();
            setDevices(all.filter(device => ['audioinput', 'audiooutput'].includes(device.kind)));
            setError('');
        } catch {
            setError('Không thể đọc danh sách thiết bị âm thanh.');
        }
    }, []);

    useEffect(() => {
        void refreshDevices();
        const onChange = () => { void refreshDevices(); };
        navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
        return () => {
            navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
            stopTest();
        };
    }, [refreshDevices, stopTest]);

    const startTest = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Trình duyệt không hỗ trợ micro hoặc trang chưa chạy trên HTTPS/localhost.');
            return;
        }
        stopTest();
        setError('');
        setNotice('');
        try {
            const audio = microphoneId ? { deviceId: { exact: microphoneId } } : true;
            const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
            streamRef.current = stream;
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) throw new Error('Trình duyệt không hỗ trợ kiểm tra mức âm thanh.');
            const context = new AudioContextClass();
            audioContextRef.current = context;
            const source = context.createMediaStreamSource(stream);
            const analyser = context.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            setTesting(true);
            await refreshDevices();
            const sample = () => {
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (const value of data) {
                    const normalized = (value - 128) / 128;
                    sum += normalized * normalized;
                }
                setLevel(Math.min(100, Math.round(Math.sqrt(sum / data.length) * 240)));
                frameRef.current = requestAnimationFrame(sample);
            };
            sample();
            setNotice('Micro đang được kiểm tra. Hãy nói thử; nhấn Dừng kiểm tra để tắt micro.');
        } catch (e) {
            stopTest();
            setError(e?.name === 'NotAllowedError'
                ? 'Bạn chưa cấp quyền micro cho trình duyệt.'
                : e?.name === 'NotFoundError'
                    ? 'Không tìm thấy micro.'
                    : e?.message || 'Không thể kiểm tra micro.');
        }
    };

    const save = () => {
        try {
            if (microphoneId) localStorage.setItem(MIC_KEY, microphoneId);
            else localStorage.removeItem(MIC_KEY);
            if (outputId) localStorage.setItem(OUTPUT_KEY, outputId);
            else localStorage.removeItem(OUTPUT_KEY);
            setNotice('Đã lưu lựa chọn âm thanh cho các cuộc gọi tiếp theo trên trình duyệt này.');
            setError('');
        } catch {
            setError('Không thể lưu lựa chọn âm thanh trong trình duyệt.');
        }
    };

    const outputsSupported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

    return (
        <section className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><AudioLines size={21} aria-hidden="true" /></span>
                <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Cài đặt micro và loa</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">Chọn thiết bị và kiểm tra micro theo yêu cầu. Không bật micro khi mở trang cài đặt.</p>
                </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="preferred-microphone" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">Micro mặc định</label>
                    <select id="preferred-microphone" value={microphoneId} onChange={e => setMicrophoneId(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        <option value="">Tự động chọn micro</option>
                        {devices.filter(d => d.kind === 'audioinput').map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Micro ${i + 1}`}</option>)}
                    </select>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="meter" aria-label="Mức âm thanh micro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level}>
                        <div className="h-full rounded-full bg-violet-600 transition-[width]" style={{ width: `${level}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mức âm thanh đầu vào: {testing ? level + '%' : 'chưa kiểm tra'}</p>
                    <button type="button" onClick={testing ? stopTest : startTest} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                        {testing ? <MicOff size={16} /> : <Mic size={16} />}{testing ? 'Dừng kiểm tra' : 'Kiểm tra micro'}
                    </button>
                </div>
                <div>
                    <label htmlFor="preferred-audio-output" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">Loa / tai nghe đầu ra</label>
                    <select id="preferred-audio-output" value={outputId} onChange={e => setOutputId(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        <option value="">Dùng đầu ra mặc định của hệ điều hành</option>
                        {devices.filter(d => d.kind === 'audiooutput').map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Đầu ra âm thanh ${i + 1}`}</option>)}
                    </select>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{outputsSupported ? 'Trình duyệt có API chọn đầu ra âm thanh; danh sách thiết bị có thể cần cấp quyền.' : 'Trình duyệt này chưa hỗ trợ đổi loa đầu ra từ ứng dụng; vẫn có thể chọn loa mặc định trong hệ điều hành.'}</p>
                    <button type="button" onClick={() => void refreshDevices()} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw size={16} />Làm mới thiết bị</button>
                </div>
            </div>
            <button type="button" onClick={save} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"><CheckCircle2 size={16} />Lưu thiết bị âm thanh</button>
            {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
            {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}
        </section>
    );
}
