import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/utils/constants.js';

const socket = io(API_BASE_URL, {
    autoConnect: false,     // 1. Không tự động kết nối khi vừa mở trang web
    withCredentials: true,  // 2. BẮT BUỘC: Cho phép trình duyệt gửi HttpOnly Cookie lên Server
    // Start with HTTP long-polling, then upgrade to WebSocket when available.
    // This avoids failing the entire connection when direct WebSocket upgrade is blocked.
    transports: ['polling', 'websocket']
});

// =====================================================
// CÁC LISTENER DÙNG ĐỂ DEBUG KẾT NỐI (LOG SYSTEM)
// =====================================================

// Khi socket kết nối thành công tới Backend
socket.on('connect', () => {
    console.log(' Socket đã kết nối thành công. Socket ID:', socket.id);
});

// Khi bị ngắt kết nối (mất mạng, server restart, hoặc gọi socket.disconnect())
socket.on('disconnect', (reason) => {
    console.warn(' Socket bị ngắt kết nối. Lý do:', reason);
});

// connect_error can be a transport/network failure or a server-side auth rejection.
// Do not label every connection error as an authentication failure.
socket.on('connect_error', (error) => {
    console.error('[SOCKET][connect_error]', {
        message: error.message,
        description: error.description,
        context: error.context
    });
});

// Surface server-side realtime throttling without flooding the user with
// one toast for every event rejected during the same rate-limit window.
const realtimeNoticeTimestamps = new Map();
const shouldShowRealtimeNotice = (key, cooldownMs = 5000) => {
    const now = Date.now();
    const previous = realtimeNoticeTimestamps.get(key) || 0;
    if (now - previous < cooldownMs) return false;
    realtimeNoticeTimestamps.set(key, now);

    if (realtimeNoticeTimestamps.size > 50) {
        for (const [noticeKey, timestamp] of realtimeNoticeTimestamps) {
            if (now - timestamp >= cooldownMs) realtimeNoticeTimestamps.delete(noticeKey);
        }
    }
    return true;
};

socket.on('socket:rate-limit', ({ event, retryAfterMs } = {}) => {
    const eventName = typeof event === 'string' ? event : 'realtime';
    if (!shouldShowRealtimeNotice(`rate-limit:${eventName}`)) return;

    const retrySeconds = Number.isFinite(Number(retryAfterMs)) && Number(retryAfterMs) > 0
        ? Math.max(1, Math.ceil(Number(retryAfterMs) / 1000))
        : null;
    const retryMessage = retrySeconds
        ? ` Vui lòng thử lại sau khoảng ${retrySeconds} giây.`
        : ' Vui lòng thử lại sau ít phút.';

    toast.warning('Bạn thao tác quá nhanh.' + retryMessage, { duration: 5000 });
});

socket.on('socket:error', (payload = {}) => {
    if (payload.code !== 'REALTIME_TEMPORARILY_UNAVAILABLE') return;
    if (!shouldShowRealtimeNotice('realtime-unavailable', 8000)) return;
    toast.error(payload.message || 'Dịch vụ realtime đang tạm thời không khả dụng.', {
        duration: 8000
    });
});

export default socket;