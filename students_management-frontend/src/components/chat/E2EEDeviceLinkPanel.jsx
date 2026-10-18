import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link2, LoaderCircle, Copy, X, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import {
    cancelProvisioning,
    connectToProvisioningSession,
    generateProvisioningQR,
    parseProvisioningQR,
    provisionDevice,
    receiveProvisioningMessage
} from '@open-e2ee/signal-protocol-sdk/device/provisioning';
import { e2eeRelayApi } from '@/api/e2eeRelayApi';
import {
    getE2EERelayAdapter,
    getE2EEStorage,
    initializeE2EEClient,
    openE2EEProvisioningContext,
    shutdownE2EEClient
} from '@/services/e2ee/e2eeClient';
import { e2eeProvisioningLocalStateStore } from '@/services/e2ee/e2eeDeviceStateStore';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export default function E2EEDeviceLinkPanel({ user, clientState }) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState('primary');
    const [qrUrl, setQrUrl] = useState('');
    const [qrInput, setQrInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [statusText, setStatusText] = useState('');
    const sessionRef = useRef(null);
    const stopRef = useRef(false);

    useEffect(() => {
        if (!open) return undefined;
        stopRef.current = false;
        return () => { stopRef.current = true; };
    }, [open]);

    const startPrimaryLink = async () => {
        if (!user?.id || !clientState?.isLocalStoreReady) {
            toast.error('Thiết bị chính chưa sẵn sàng. Hãy đợi E2EE khởi tạo xong.');
            return;
        }
        const relay = getE2EERelayAdapter();
        const storage = getE2EEStorage();
        if (!relay || !storage || Number(clientState.deviceId) !== 1) {
            toast.error('Chỉ thiết bị chính đã đăng ký mới có thể tạo mã liên kết.');
            return;
        }
        setBusy(true);
        setStatusText('Đang tạo phiên liên kết bảo mật…');
        try {
            const session = await generateProvisioningQR(relay, String(user.id));
            sessionRef.current = { ...session, relay };
            setQrUrl(session.qrCodeUrl);
            setMode('primary-waiting');
            setStatusText('Quét mã này trên thiết bị mới hoặc sao chép liên kết sang thiết bị đó.');
            const deadline = Date.now() + 5 * 60 * 1000;
            let newDeviceKey = null;
            while (!stopRef.current && Date.now() < deadline) {
                const response = await e2eeRelayApi.getProvisioningMessage(session.sessionId);
                const state = response.data?.data;
                if (state?.newDeviceEphemeralPublicKey) {
                    newDeviceKey = state.newDeviceEphemeralPublicKey;
                    break;
                }
                if (state?.status === 'expired' || state?.status === 'rolled_back') {
                    throw new Error('Phiên liên kết đã hết hạn hoặc bị hủy.');
                }
                await wait(1000);
            }
            if (stopRef.current) return;
            if (!newDeviceKey) throw new Error('Đã hết thời gian chờ thiết bị mới.');
            setStatusText('Đang mã hóa và chuyển identity sang thiết bị mới…');
            await provisionDevice(
                relay,
                { name: user.fullName || user.full_name || user.name || user.username || 'Người dùng' },
                session.sessionId,
                session.ephemeralKeyPair.privateKey,
                newDeviceKey,
                String(user.id),
                { identityStore: storage }
            );
            setStatusText('Đã gửi gói provisioning được mã hóa. Đang chờ thiết bị mới xác nhận…');
            while (!stopRef.current && Date.now() < deadline) {
                const response = await e2eeRelayApi.getProvisioningMessage(session.sessionId);
                const state = response.data?.data;
                if (state?.status === 'completed') {
                    toast.success('Đã liên kết thiết bị E2EE mới.');
                    setStatusText('Liên kết thiết bị hoàn tất.');
                    return;
                }
                if (state?.status === 'rolled_back' || state?.status === 'expired') {
                    throw new Error('Thiết bị mới không hoàn tất provisioning.');
                }
                await wait(1000);
            }
            if (!stopRef.current) throw new Error('Thiết bị mới chưa xác nhận trước khi phiên hết hạn.');
        } catch (error) {
            if (!stopRef.current) {
                setStatusText(error?.message || 'Không thể liên kết thiết bị.');
                toast.error(error?.message || 'Không thể liên kết thiết bị.');
            }
        } finally {
            setBusy(false);
        }
    };

    const connectThisDevice = async () => {
        if (!user?.id || !qrInput.trim()) {
            toast.error('Hãy dán liên kết provisioning từ thiết bị chính.');
            return;
        }
        setBusy(true);
        setStatusText('Đang kết nối phiên liên kết…');
        let context;
        try {
            const qr = parseProvisioningQR(qrInput.trim());
            context = await openE2EEProvisioningContext(String(user.id));
            const metadata = {
                deviceName: 'Trình duyệt web',
                platform: 'web',
                appVersion: '1.0.0',
                osVersion: 'web'
            };
            const ephemeral = await connectToProvisioningSession(
                context.relay,
                qr.sessionId,
                metadata
            );
            setStatusText('Đã kết nối. Đang chờ gói identity được mã hóa từ thiết bị chính…');
            const deadline = Date.now() + 5 * 60 * 1000;
            let ready = false;
            while (!stopRef.current && Date.now() < deadline) {
                const response = await e2eeRelayApi.getProvisioningMessage(qr.sessionId);
                const state = response.data?.data;
                if (state?.status === 'ready' && state.message) {
                    ready = true;
                    break;
                }
                if (state?.status === 'expired' || state?.status === 'rolled_back') {
                    throw new Error('Phiên liên kết đã hết hạn hoặc bị hủy.');
                }
                await wait(1000);
            }
            if (stopRef.current) return;
            if (!ready) throw new Error('Đã hết thời gian chờ gói provisioning.');
            await receiveProvisioningMessage(
                context.relay,
                qr.sessionId,
                ephemeral.privateKey,
                qr.primaryEphemeralPublicKey,
                {
                    identityStore: context.storage,
                    localStateStore: e2eeProvisioningLocalStateStore(String(user.id)),
                    deviceMetadata: metadata
                }
            );
            await context.close();
            context = null;
            await shutdownE2EEClient();
            await initializeE2EEClient(String(user.id));
            toast.success('Đã liên kết thiết bị. E2EE đã sẵn sàng trên trình duyệt này.');
            setStatusText('Thiết bị đã liên kết thành công.');
            setQrInput('');
            setMode('primary');
        } catch (error) {
            setStatusText(error?.message || 'Không thể liên kết thiết bị.');
            toast.error(error?.message || 'Không thể liên kết thiết bị.');
        } finally {
            if (context) {
                try { await context.close(); } catch { /* preserve original result */ }
            }
            setBusy(false);
        }
    };

    const closePanel = async () => {
        stopRef.current = true;
        const session = sessionRef.current;
        if (session?.sessionId && session?.relay) {
            await cancelProvisioning(session.relay, session.sessionId, String(user.id));
        }
        sessionRef.current = null;
        setQrUrl('');
        setOpen(false);
        setBusy(false);
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(qrUrl);
            toast.success('Đã sao chép liên kết provisioning.');
        } catch {
            toast.error('Không thể sao chép tự động. Hãy chọn và sao chép liên kết.');
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setMode(['E2EE_DEVICE_LINK_REQUIRED', 'E2EE_DEVICE_REVOKED'].includes(clientState?.errorCode) ? 'link-this-device' : 'primary');
                    setOpen(true);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                title="Liên kết thiết bị E2EE"
            >
                <Smartphone size={16} />
                Thiết bị E2EE
            </button>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Liên kết thiết bị E2EE">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="text-emerald-600" size={21} />
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Liên kết thiết bị E2EE</h2>
                            </div>
                            <button type="button" onClick={closePanel} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Đóng">
                                <X size={18} />
                            </button>
                        </div>

                        {mode === 'link-this-device' ? (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Trên thiết bị chính, mở mục Thiết bị E2EE rồi quét hoặc sao chép liên kết sang đây. Identity được chuyển trong gói mã hóa đầu cuối.
                                </p>
                                <textarea
                                    value={qrInput}
                                    onChange={event => setQrInput(event.target.value)}
                                    rows={3}
                                    placeholder="Dán signalprotocol://link-device?session=…&key=…"
                                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                                <button type="button" disabled={busy || !qrInput.trim()} onClick={connectThisDevice} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                                    {busy && <LoaderCircle size={16} className="animate-spin" />}
                                    Kết nối thiết bị này
                                </button>
                            </div>
                        ) : mode === 'primary-waiting' ? (
                            <div className="space-y-3 text-center">
                                {qrUrl && <div className="mx-auto inline-block rounded-xl border border-slate-200 bg-white p-3"><QRCodeSVG value={qrUrl} size={220} level="M" /></div>}
                                <p className="break-all rounded-lg bg-slate-50 p-2 text-left text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{qrUrl}</p>
                                <button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><Copy size={15} /> Sao chép liên kết</button>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{statusText}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Tạo mã liên kết trên thiết bị chính để chuyển identity một cách mã hóa. Không gửi private key trực tiếp qua chat hoặc email.
                                </p>
                                <button type="button" disabled={busy || !clientState?.isLocalStoreReady || Number(clientState.deviceId) !== 1} onClick={startPrimaryLink} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                                    {busy && <LoaderCircle size={16} className="animate-spin" />}
                                    Tạo mã liên kết
                                </button>
                                {['E2EE_DEVICE_LINK_REQUIRED', 'E2EE_DEVICE_REVOKED'].includes(clientState?.errorCode) && (
                                    <button type="button" onClick={() => setMode('link-this-device')} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700">
                                        Liên kết trình duyệt này từ thiết bị chính
                                    </button>
                                )}
                            </div>
                        )}
                        {statusText && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{statusText}</p>}
                    </div>
                </div>
            )}
        </>
    );
}
