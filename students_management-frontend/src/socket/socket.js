import { io } from 'socket.io-client';
import { API_BASE_URL } from '@/utils/constants.js';

const socket = io(API_BASE_URL, {
    autoConnect: false,     // 1. Không tự động kết nối khi vừa mở trang web
    withCredentials: true,  // 2. BẮT BUỘC: Cho phép trình duyệt gửi HttpOnly Cookie lên Server
    transports: ['websocket', 'polling'] // Tùy chọn: Đảm bảo khả năng tương thích kết nối
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

// Khi Backend từ chối kết nối (Ví dụ: HttpOnly Cookie hết hạn hoặc thiếu Session)
socket.on('connect_error', (error) => {
    console.error(' Lỗi kết nối Socket (Xác thực thất bại):', error.message);
});

export default socket;