import { useCallback, useEffect, useState } from 'react';
import { chatApi } from '@/api/chatApi';
import { userApi } from '@/api/userApi';
import socket from '@/socket/socket.js';

export const useChat = () => {
    const [conversations, setConversations] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [onlineUserIds, setOnlineUserIds] = useState(new Set());

    const fetchConversations = useCallback(async () => {
        try {
            const res = await chatApi.getConversations();
            const data = res.data?.data || [];
            setConversations(prev => data.map(conversation => ({
                ...conversation,
                isOnline: onlineUserIds.has(Number(conversation.userId))
            })));
        } catch (error) {
            console.error('Lỗi lấy danh sách conversation:', error);
        }
    }, [onlineUserIds]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    useEffect(() => {
        if (!activeId) {
            setMessages([]);
            return;
        }

        let cancelled = false;

        const loadMessages = async () => {
            setLoading(true);
            try {
                const res = await chatApi.getMessages(activeId);
                if (cancelled) return;

                setMessages(res.data?.data || []);
                await chatApi.markAsRead(activeId);
                if (socket.connected) socket.emit('message:read', { conversationId: activeId });

                setConversations(prev => prev.map(c =>
                    c.id === activeId ? { ...c, unreadCount: 0 } : c
                ));

                if (socket.connected) {
                    socket.emit('conversation:join', { conversationId: activeId });
                }
            } catch (error) {
                console.error('Lỗi lấy tin nhắn:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadMessages();

        return () => {
            cancelled = true;
            if (socket.connected) {
                socket.emit('conversation:leave', { conversationId: activeId });
            }
            setIsTyping(false);
        };
    }, [activeId]);

    useEffect(() => {
        const handleNewMessage = (message) => {
            const conversationId = Number(message.conversation_id ?? message.conversationId);

            if (conversationId === Number(activeId)) {
                setMessages(prev => {
                    if (prev.some(item => item.id === message.id)) return prev;
                    return [...prev, message];
                });
                chatApi.markAsRead(conversationId).catch(() => {});
            }

            setConversations(prev => prev.map(c => {
                if (Number(c.id) !== conversationId) return c;

                return {
                    ...c,
                    lastMessage: message.content,
                    lastMessageAt: message.created_at,
                    unreadCount: Number(c.id) === Number(activeId)
                        ? 0
                        : (c.unreadCount || 0) + 1
                };
            }));
        };

        const handleConversationUpdated = ({ conversationId, lastMessage, updatedAt }) => {
            setConversations(prev => {
                const exists = prev.some(c => Number(c.id) === Number(conversationId));

                if (!exists) {
                    fetchConversations();
                    return prev;
                }

                return prev
                    .map(c => Number(c.id) === Number(conversationId)
                        ? {
                            ...c,
                            lastMessage: lastMessage?.content || '',
                            lastMessageAt: updatedAt,
                            unreadCount: Number(c.id) === Number(activeId)
                                ? 0
                                : (c.unreadCount || 0) + 1
                        }
                        : c)
                    .sort((a, b) =>
                        new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
                    );
            });
        };

        const handleTypingStart = ({ conversationId }) => {
            if (Number(conversationId) === Number(activeId)) setIsTyping(true);
        };

        const handleTypingStop = ({ conversationId }) => {
            if (Number(conversationId) === Number(activeId)) setIsTyping(false);
        };

        const handleMessagesRead = ({ conversationId, readBy }) => {
            if (Number(conversationId) !== Number(activeId)) return;
            setMessages(prev => prev.map(message =>
                Number(message.sender_id ?? message.senderId) !== Number(readBy)
                    ? { ...message, is_read: true }
                    : message
            ));
        };

        const handleMessageError = ({ message }) => {
            console.error('Socket message error:', message);
        };

        const handlePresenceOnline = ({ userId }) => {
            const id = Number(userId);
            if (!Number.isInteger(id)) return;
            setOnlineUserIds(prev => {
                const next = new Set(prev);
                next.add(id);
                return next;
            });
            setConversations(prev => prev.map(c =>
                Number(c.userId) === id ? { ...c, isOnline: true } : c
            ));
        };

        const handlePresenceOffline = ({ userId }) => {
            const id = Number(userId);
            if (!Number.isInteger(id)) return;
            setOnlineUserIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setConversations(prev => prev.map(c =>
                Number(c.userId) === id ? { ...c, isOnline: false } : c
            ));
        };

        socket.on('presence:online', handlePresenceOnline);
        socket.on('presence:offline', handlePresenceOffline);
        socket.on('message:new', handleNewMessage);
        socket.on('conversation:updated', handleConversationUpdated);
        socket.on('typing:start', handleTypingStart);
        socket.on('typing:stop', handleTypingStop);
        socket.on('messages:read', handleMessagesRead);
        socket.on('message:error', handleMessageError);

        return () => {
            socket.off('presence:online', handlePresenceOnline);
            socket.off('presence:offline', handlePresenceOffline);
            socket.off('message:new', handleNewMessage);
            socket.off('conversation:updated', handleConversationUpdated);
            socket.off('typing:start', handleTypingStart);
            socket.off('typing:stop', handleTypingStop);
            socket.off('messages:read', handleMessagesRead);
            socket.off('message:error', handleMessageError);
        };
    }, [activeId, fetchConversations]);

    const sendMessage = useCallback((content) => {
        const text = content.trim();
        if (!activeId || !text || !socket.connected) return;

        socket.emit('message:send', {
            conversationId: activeId,
            content: text
        });
    }, [activeId]);

    const searchUsers = useCallback(async (search) => {
        try {
            const res = await userApi.searchForChat(search);
            setSearchResults(res.data?.data || []);
        } catch (error) {
            console.error('Lỗi tìm user:', error);
            setSearchResults([]);
        }
    }, []);

    const startConversation = useCallback(async (targetUserId) => {
        const res = await chatApi.createDirectConversation(targetUserId);
        const conversation = res.data?.data;

        await fetchConversations();
        if (conversation?.id) setActiveId(conversation.id);

        return conversation;
    }, [fetchConversations]);

    const setTyping = useCallback((typing) => {
        if (!activeId || !socket.connected) return;

        socket.emit(typing ? 'typing:start' : 'typing:stop', {
            conversationId: activeId
        });
    }, [activeId]);

    return {
        conversations,
        activeId,
        setActiveId,
        messages,
        onlineUserIds,
        loading,
        isTyping,
        sendMessage,
        searchResults,
        searchUsers,
        startConversation,
        setTyping,
        refetchConversations: fetchConversations
    };
};