import { io } from 'socket.io-client';
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

export default socket;