import { useState, useEffect, useCallback } from 'react';
import { chatApi } from '@/api/chatApi';
// Dòng 3 file src/hooks/useChat.js:
import socket from '@/socket/socket.js'; //  Bỏ dấu { }

// quản lý toàn bộ state và gọi API lấy danh sách/tin nhắn và lắng nghe Realtime từ Socket
export const useChat = () => {
    const [conversations, setConversations] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);

    // 1. Lấy danh sách cuộc trò chuyện ban đầu
    const fetchConversations = async () => {
        try {
            const res = await chatApi.getConversations();
            setConversations(res.data || []);
        } catch (error) {
            console.error("Lỗi lấy danh sách conversation:", error);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    // 2. Khi chọn 1 Conversation -> Lấy lịch sử tin nhắn & Đánh dấu đã đọc
    useEffect(() => {
        if (!activeId) return;

        const loadMessages = async () => {
            setLoading(true);
            try {
                const res = await chatApi.getMessages(activeId);
                setMessages(res.data || []);

                // Gọi API đánh dấu đã đọc
                await chatApi.markAsRead(activeId);

                // Cập nhật lại số unreadCount = 0 ở danh sách Sidebar
                setConversations(prev =>
                    prev.map(c => c.id === activeId ? { ...c, unreadCount: 0 } : c)
                );
            } catch (error) {
                console.error("Lỗi lấy tin nhắn:", error);
            } finally {
                setLoading(false);
            }
        };

        loadMessages();

        // Join room Socket
        socket.emit('join_conversation', activeId);

    }, [activeId]);

    // 3. Lắng nghe Socket realtime (Tin nhắn mới, typing...)
    useEffect(() => {
        socket.on('receive_message', (newMessage) => {
            // Nếu tin nhắn thuộc conversation đang mở -> Thêm vào list tin nhắn
            if (newMessage.conversationId === activeId) {
                setMessages(prev => [...prev, newMessage]);
                chatApi.markAsRead(activeId); // Tự động đánh dấu đã đọc
            }

            // Cập nhật lastMessage ở Sidebar
            setConversations(prev => prev.map(c => {
                if (c.id === newMessage.conversationId) {
                    return {
                        ...c,
                        lastMessage: newMessage.content,
                        time: newMessage.time,
                        unreadCount: c.id === activeId ? 0 : (c.unreadCount || 0) + 1
                    };
                }
                return c;
            }));
        });

        socket.on('user_typing', ({ conversationId, typing }) => {
            if (conversationId === activeId) {
                setIsTyping(typing);
            }
        });

        return () => {
            socket.off('receive_message');
            socket.off('user_typing');
        };
    }, [activeId]);

    // 4. Hàm gửi tin nhắn
const sendMessage = async (content) => {
    if (!activeId || !content.trim()) return;

    try {
        // 1. Gọi API lưu tin nhắn vào Database
        const res = await chatApi.sendMessage({
            conversationId: activeId,
            content
        });

        // 2. Cập nhật ngay tin nhắn vừa gửi vào state local để UI hiển thị tức thì
        const newMsg = res.data;
        setMessages(prev => [...prev, newMsg]);

        // 3. (Tùy chọn) Bắn sự kiện socket nếu backend yêu cầu client phát trực tiếp
        socket.emit('send_message', newMsg);

    } catch (error) {
        console.error("Lỗi gửi tin nhắn:", error);
    }
};
    
    return {
        conversations,
        activeId,
        setActiveId,
        messages,
        loading,
        isTyping,
        sendMessage,
        refetchConversations: fetchConversations
    };
    
};