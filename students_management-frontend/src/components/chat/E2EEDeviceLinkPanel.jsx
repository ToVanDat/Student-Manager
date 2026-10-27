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

export default function E2EEDeviceLinkPanel({ user, clientState, compact = false }) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState('primary');
    const [qrUrl, setQrUrl] = useState('');
    const [qrInput, setQrInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [devices, setDevices] = useState([]);
    const [devicesLoading, setDevicesLoading] = useState(false);
    const [revokingDeviceId, setRevokingDeviceId] = useState(null);
    const sessionRef = useRef(null);
    const stopRef = useRef(false);

    useEffect(() => {
        if (!open) return undefined;
        stopRef.current = false;
        return () => { stopRef.current = true; };
    }, [open]);

    useEffect(() => {
        if (!open || !user?.id) return undefined;
        let cancelled = false;
        setDevicesLoading(true);
        e2eeRelayApi.getDevices(user.id)
            .then(response => {
                if (!cancelled) setDevices(Array.isArray(response.data?.data) ? response.data.data : []);
            })
            .catch(error => {
                if (!cancelled) {
                    setDevices([]);
                    setStatusText(error?.response?.data?.message || 'Không thể tải danh sách thiết bị E2EE.');
                }
            })
            .finally(() => { if (!cancelled) setDevicesLoading(false); });
        return () => { cancelled = true; };
    }, [open, user?.id, clientState?.deviceId]);

    const revokeLinkedDevice = async device => {
        const deviceId = Number(device?.deviceId);
        if (!Number.isInteger(deviceId) || deviceId < 1 || deviceId > 5) return;
        if (deviceId === Number(clientState?.deviceId)) {
            toast.error('Không thể thu hồi thiết bị đang sử dụng từ chính thiết bị đó. Hãy thực hiện trên một thiết bị tin cậy khác.');
            return;
        }
        const confirmed = window.confirm('Thu hồi thiết bị E2EE này? Thiết bị sẽ không thể gửi/nhận envelope mới bằng credential hiện tại. Có thể cần liên kết lại các thiết bị còn lại nếu identity bị xoay vòng.');
        if (!confirmed) return;
        setRevokingDeviceId(deviceId);
        try {
            await e2eeRelayApi.removeDevice(deviceId);
            setDevices(previous => previous.filter(item => Number(item.deviceId) !== deviceId));
            toast.success('Đã thu hồi thiết bị E2EE.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Không thể thu hồi thiết bị.');
        } finally {
            setRevokingDeviceId(null);
        }
    };

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
            await relay.prepareProvisioningRecovery(session.sessionId);
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
            const pendingSession = sessionRef.current;
            if (pendingSession?.sessionId && pendingSession?.relay?.abortProvisioningSession) {
                try {
                    await pendingSession.relay.abortProvisioningSession(pendingSession.sessionId);
                } catch (abortError) {
                    console.warn('[E2EE] owner provisioning abort deferred to durable recovery', {
                        code: abortError?.code || 'PROVISIONING_ABORT_FAILED'
                    });
                }
            }
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
            await session.relay.abortProvisioningSession?.(session.sessionId);
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
                role={compact ? 'menuitem' : undefined}
                onClick={() => {
                    setMode(
                        ['E2EE_DEVICE_LINK_REQUIRED', 'E2EE_DEVICE_REVOKED', 'E2EE_DEVICE_CREDENTIAL_MISSING'].includes(clientState?.errorCode) ||
                        (clientState?.deviceId != null && Number(clientState.deviceId) !== 1)
                            ? 'link-this-device'
                            : 'primary'
                    );
                    setOpen(true);
                }}
                className={compact
                    ? "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-700"
                    : "inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"}
                title="Liên kết thiết bị E2EE"
            >
                <Smartphone size={16} className={compact ? "shrink-0 text-slate-500 dark:text-slate-400" : ""} />
                <span>Thiết bị E2EE</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Liên kết thiết bị E2EE">
                    <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="text-emerald-600" size={21} />
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Liên kết thiết bị E2EE</h2>
                            </div>
                            <button type="button" onClick={closePanel} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Đóng">
                                <X size={18} />
                            </button>
                        </div>

                        <section className="mb-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700" aria-label="Danh sách thiết bị E2EE">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Thiết bị đã đăng ký</h3>
                                <span className="text-xs text-slate-500 dark:text-slate-400">{devicesLoading ? 'Đang tải…' : `${devices.length} thiết bị`}</span>
                            </div>
                            {!devicesLoading && devices.length === 0 ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có thiết bị E2EE nào được đăng ký hoặc không tải được danh sách.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {devices.map(device => (
                                        <li key={device.deviceId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">Thiết bị {device.deviceId} {Number(device.deviceId) === 1 ? '· chính' : ''} {Number(device.deviceId) === Number(clientState?.deviceId) ? '· hiện tại' : ''}</p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{device.deviceType || 'web'} · {device.enabled ? 'đang bật' : 'đã tắt'}{device.lastSeenAt ? ` · hoạt động ${new Date(device.lastSeenAt).toLocaleString()}` : ''}</p>
                                            </div>
                                            <button type="button" disabled={revokingDeviceId != null || Number(device.deviceId) === Number(clientState?.deviceId)} onClick={() => revokeLinkedDevice(device)} className="shrink-0 rounded-lg border border-rose-200 px-2 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40" title={Number(device.deviceId) === Number(clientState?.deviceId) ? 'Thu hồi thiết bị này từ một thiết bị tin cậy khác' : 'Thu hồi thiết bị'}>
                                                {revokingDeviceId === Number(device.deviceId) ? 'Đang thu hồi…' : 'Thu hồi'}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

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
                                {!clientState?.isLocalStoreReady && (
                                    <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                                        {clientState?.errorCode === 'E2EE_DEVICE_LINK_REQUIRED'
                                            ? 'Tài khoản đã có identity E2EE trên thiết bị khác. Hãy liên kết trình duyệt này từ thiết bị chính; không tạo identity mới.'
                                            : clientState?.errorCode === 'E2EE_DEVICE_REVOKED'
                                                ? 'Thiết bị này đã bị thu hồi. Hãy liên kết lại từ thiết bị chính.'
                                                : clientState?.errorCode === 'E2EE_DEVICE_CREDENTIAL_MISSING'
                                                    ? 'Thiết bị chưa có thông tin xác thực cục bộ. Hãy liên kết từ thiết bị chính.'
                                                    : 'Đang khởi tạo kho khóa E2EE cục bộ. Nút tạo mã sẽ mở khi thiết bị chính sẵn sàng.'}
                                    </p>
                                )}
                                {clientState?.isLocalStoreReady && Number(clientState.deviceId) !== 1 && (
                                    <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                                        Thiết bị này không phải thiết bị chính (ID {String(clientState.deviceId)}). Hãy mở mục này trên thiết bị chính để tạo mã, sau đó dán mã vào đây.
                                    </p>
                                )}
                                <button type="button" disabled={busy || !clientState?.isLocalStoreReady || Number(clientState.deviceId) !== 1} onClick={startPrimaryLink} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                                    {busy && <LoaderCircle size={16} className="animate-spin" />}
                                    Tạo mã liên kết
                                </button>
                                {(['E2EE_DEVICE_LINK_REQUIRED', 'E2EE_DEVICE_REVOKED', 'E2EE_DEVICE_CREDENTIAL_MISSING'].includes(clientState?.errorCode) || (clientState?.deviceId != null && Number(clientState.deviceId) !== 1)) && (
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
