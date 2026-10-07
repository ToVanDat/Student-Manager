import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { chatApi } from '@/api/chatApi';
import { userApi } from '@/api/userApi';
import socket from '@/socket/socket.js';

export const useChat = () => {
    const { user } = useAuth();
    const currentUserId = Number(user?.id);
    const [conversations, setConversations] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [onlineUserIds, setOnlineUserIds] = useState(new Set());

    const fetchConversations = useCallback(async () => {
        try {
            const res = await chatApi.getConversations();
            const data = res.data?.data || [];
            setConversations(data);
        } catch (error) {
            console.error('Lỗi lấy danh sách conversation:', error);
        }
    }, []);

    useEffect(() => {
        // User đổi sau logout/login: không được giữ state chat của user cũ.
        setConversations([]);
        setMessages([]);
        setActiveId(null);
        setSearchResults([]);
        setOnlineUserIds(new Set());

        if (currentUserId > 0) {
            fetchConversations();
        }
    }, [currentUserId, fetchConversations]);

    useEffect(() => {
        if (!activeId) {
            setMessages([]);
            return;
        }

        let cancelled = false;

        const loadMessages = async () => {
            setLoading(true);
            try {
                const res = await chatApi.getMessages(activeId, 1, 50);
                if (cancelled) return;

                setMessages(res.data?.data || []);
                setHasMoreMessages(Boolean(res.data?.pagination?.hasMore));
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
        const joinActiveConversation = () => {
            if (!socket.connected || !activeId) return;

            socket.emit('conversation:join', {
                conversationId: activeId
            });
        };

        const handleSocketConnect = () => {
            // AuthContext có thể kết nối socket trước khi useChat được mount.
            // Vì vậy khi socket connect/reconnect, luôn join lại conversation hiện tại.
            joinActiveConversation();
        };

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
                    unreadCount: Number(c.id) === Number(activeId) || Number(message.sender_id ?? message.senderId) === currentUserId
                        ? 0
                        : (c.unreadCount || 0) + 1
                };
            }));
        };

        const handleConversationUpdated = ({ conversationId, lastMessage, senderId, updatedAt }) => {
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
                            unreadCount: Number(c.id) === Number(activeId) || Number(senderId) === currentUserId
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

        const handleMessageUpdated = (updatedMessage) => {
            if (Number(updatedMessage.conversation_id) !== Number(activeId)) return;
            setMessages(prev => prev.map(item =>
                Number(item.id) === Number(updatedMessage.id)
                    ? { ...item, ...updatedMessage }
                    : item
            ));
            setConversations(prev => prev.map(c =>
                Number(c.id) === Number(updatedMessage.conversation_id)
                    ? { ...c, lastMessage: updatedMessage.content, lastMessageAt: updatedMessage.updated_at }
                    : c
            ));
        };

        const handleMessageRecalled = (recalledMessage) => {
            if (Number(recalledMessage.conversation_id) !== Number(activeId)) return;
            setMessages(prev => prev.map(item =>
                Number(item.id) === Number(recalledMessage.id)
                    ? { ...item, ...recalledMessage }
                    : item
            ));
        };

        const handleMessageDeletedEveryone = (deletedMessage) => {
            if (Number(deletedMessage.conversation_id) !== Number(activeId)) return;
            setMessages(prev => prev.map(item =>
                Number(item.id) === Number(deletedMessage.id)
                    ? { ...item, ...deletedMessage }
                    : item
            ));
        };

        const handleReactionUpdated = ({ messageId, conversationId, action, reaction }) => {
            if (Number(conversationId) !== Number(activeId)) return;

            setMessages(prev => prev.map(item => {
                if (Number(item.id) !== Number(messageId)) return item;

                const reactions = Array.isArray(item.reactions) ? item.reactions : [];
                if (action === 'add') {
                    if (reactions.some(r => Number(r.id) === Number(reaction?.id))) return item;
                    return { ...item, reactions: [...reactions, reaction] };
                }

                return {
                    ...item,
                    reactions: reactions.filter(r =>
                        !(Number(r.user_id) === Number(reaction?.user_id) &&
                          r.emoji === reaction?.emoji)
                    )
                };
            }));
        };

        const handleMessageDeletedMe = ({ messageId, conversationId }) => {
            if (Number(conversationId) !== Number(activeId)) return;
            setMessages(prev => prev.filter(item => Number(item.id) !== Number(messageId)));
        };

        const handleMessageFileUploaded = ({ messageId, conversationId, file }) => {
            if (Number(conversationId) !== Number(activeId)) return;

            setMessages(prev => {
                const exists = prev.some(item => Number(item.id) === Number(messageId));

                if (!exists) {
                    return [
                        ...prev,
                        {
                            id: messageId,
                            conversation_id: conversationId,
                            content: `📎 ${file.file_name}`,
                            files: [file],
                            created_at: file.created_at
                        }
                    ];
                }

                return prev.map(item =>
                    Number(item.id) === Number(messageId)
                        ? {
                            ...item,
                            files: [
                                ...(item.files || []).filter(
                                    existing => Number(existing.id) !== Number(file.id)
                                ),
                                file
                            ]
                        }
                        : item
                );
            });
        };

        const handleMessageError = ({ message }) => {
            console.error('Socket message error:', message);
        };

        const handlePresenceOnline = ({ userId }) => {
            const id = Number(userId);
            if (!Number.isInteger(id)) return;

            setOnlineUserIds(prev => {
                if (prev.has(id)) return prev;
                const next = new Set(prev);
                next.add(id);
                return next;
            });

            setConversations(prev => prev.map(c =>
                Number(c.userId) === id && !c.isOnline
                    ? { ...c, isOnline: true }
                    : c
            ));
        };

        const handlePresenceSnapshot = ({ userIds = [] }) => {
            const ids = new Set(
                userIds
                    .map(Number)
                    .filter(Number.isInteger)
            );

            setOnlineUserIds(ids);

            setConversations(prev => {
                let changed = false;

                const next = prev.map(c => {
                    const isOnline = ids.has(Number(c.userId));
                    if (c.isOnline === isOnline) return c;
                    changed = true;
                    return { ...c, isOnline };
                });

                return changed ? next : prev;
            });
        };

        const handlePresenceOffline = ({ userId }) => {
            const id = Number(userId);
            if (!Number.isInteger(id)) return;

            setOnlineUserIds(prev => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
            });

            setConversations(prev => prev.map(c =>
                Number(c.userId) === id && c.isOnline
                    ? { ...c, isOnline: false }
                    : c
            ));
        };

        socket.on('connect', handleSocketConnect);
        socket.on('presence:snapshot', handlePresenceSnapshot);
        if (socket.connected) {
            socket.emit('presence:sync');
            joinActiveConversation();
        }
        socket.on('presence:online', handlePresenceOnline);
        socket.on('presence:offline', handlePresenceOffline);
        socket.on('message:new', handleNewMessage);
        socket.on('conversation:updated', handleConversationUpdated);
        socket.on('typing:start', handleTypingStart);
        socket.on('typing:stop', handleTypingStop);
        socket.on('messages:read', handleMessagesRead);
        socket.on('message:updated', handleMessageUpdated);
        socket.on('message:recalled', handleMessageRecalled);
        socket.on('message:deleted:everyone', handleMessageDeletedEveryone);
        socket.on('message:deleted:me', handleMessageDeletedMe);
        socket.on('message:reaction:updated', handleReactionUpdated);
        socket.on('message:file:uploaded', handleMessageFileUploaded);
        socket.on('message:error', handleMessageError);

        return () => {
            socket.off('connect', handleSocketConnect);
            socket.off('presence:snapshot', handlePresenceSnapshot);
            socket.off('presence:online', handlePresenceOnline);
            socket.off('presence:offline', handlePresenceOffline);
            socket.off('message:new', handleNewMessage);
            socket.off('conversation:updated', handleConversationUpdated);
            socket.off('typing:start', handleTypingStart);
            socket.off('typing:stop', handleTypingStop);
            socket.off('messages:read', handleMessagesRead);
            socket.off('message:updated', handleMessageUpdated);
            socket.off('message:recalled', handleMessageRecalled);
            socket.off('message:deleted:everyone', handleMessageDeletedEveryone);
            socket.off('message:deleted:me', handleMessageDeletedMe);
            socket.off('message:reaction:updated', handleReactionUpdated);
            socket.off('message:file:uploaded', handleMessageFileUploaded);
            socket.off('message:error', handleMessageError);
        };
    }, [activeId, fetchConversations, currentUserId]);

    const editMessage = useCallback(async (messageId, content) => {
        const text = typeof content === 'string' ? content.trim() : '';
        if (!messageId || !text) return;

        try {
            const res = await chatApi.editMessage(messageId, text);
            const updatedMessage = res.data?.data;

            if (updatedMessage) {
                setMessages(prev => prev.map(item =>
                    Number(item.id) === Number(updatedMessage.id)
                        ? { ...item, ...updatedMessage }
                        : item
                ));
            }
        } catch (error) {
            console.error('Không thể chỉnh sửa message:', error);
        }
    }, []);

    const recallMessage = useCallback(async (messageId) => {
        if (!messageId) return;

        try {
            const res = await chatApi.recallMessage(messageId);
            const recalledMessage = res.data?.data;

            if (recalledMessage) {
                setMessages(prev => prev.map(item =>
                    Number(item.id) === Number(recalledMessage.id)
                        ? { ...item, ...recalledMessage }
                        : item
                ));
            }
        } catch (error) {
            console.error('Không thể thu hồi message:', error);
        }
    }, []);

    const deleteMessageForMe = useCallback(async (messageId) => {
        if (!messageId) return;

        try {
            await chatApi.deleteMessageForMe(messageId);
            setMessages(prev =>
                prev.filter(item => Number(item.id) !== Number(messageId))
            );
        } catch (error) {
            console.error('Không thể xoá message cho tôi:', error);
        }
    }, []);

    const deleteMessageForEveryone = useCallback(async (messageId) => {
        if (!messageId) return;

        try {
            const res = await chatApi.deleteMessageForEveryone(messageId);
            const deletedMessage = res.data?.data;

            if (deletedMessage) {
                setMessages(prev => prev.map(item =>
                    Number(item.id) === Number(deletedMessage.id)
                        ? { ...item, ...deletedMessage }
                        : item
                ));
            }
        } catch (error) {
            console.error('Không thể xoá message cho tất cả:', error);
        }
    }, []);

    const sendAttachment = useCallback(async (file) => {
        if (!activeId || !file) return;

        const placeholder = `📎 ${file.name}`;
        const messageResponse = await chatApi.sendMessage(activeId, placeholder);
        const message = messageResponse.data?.data;

        if (!message?.id) {
            throw new Error('Không tạo được message cho file');
        }

        try {
            const uploadResponse = await chatApi.uploadFile(message.id, file);
            const uploadedFile = uploadResponse.data?.file;

            if (uploadedFile) {
                setMessages(prev => prev.map(item =>
                    Number(item.id) === Number(message.id)
                        ? { ...item, files: [uploadedFile] }
                        : item
                ));
            }

            return uploadedFile;
        } catch (error) {
            // Không xoá message tự động để tránh xoá nhầm trong race condition.
            throw error;
        }
    }, [activeId]);

    const sendMessage = useCallback((content, replyToMessageId = null) => {
        const text = typeof content === 'string' ? content.trim() : '';
        if (!activeId || !text || !socket.connected) return;

        socket.emit('message:send', {
            conversationId: activeId,
            content: text,
            replyToMessageId
        });
    }, [activeId]);

    const loadOlderMessages = useCallback(async () => {
        if (!activeId || loadingOlder || !hasMoreMessages) return;

        setLoadingOlder(true);
        try {
            const currentPage = Math.max(Math.ceil(messages.length / 50), 1);
            const nextPage = currentPage + 1;
            const res = await chatApi.getMessages(activeId, nextPage, 50);
            const older = res.data?.data || [];

            setMessages(prev => {
                const existing = new Set(prev.map(item => Number(item.id)));
                const uniqueOlder = older.filter(item => !existing.has(Number(item.id)));
                return [...uniqueOlder, ...prev];
            });
            setHasMoreMessages(Boolean(res.data?.pagination?.hasMore));
        } catch (error) {
            console.error('Không thể tải thêm messages:', error);
        } finally {
            setLoadingOlder(false);
        }
    }, [activeId, loadingOlder, hasMoreMessages, messages.length]);

    const toggleReaction = useCallback(async (messageId, emoji) => {
        if (!messageId || !emoji || !socket.connected) return;

        const message = messages.find(item => Number(item.id) === Number(messageId));
        const mine = (message?.reactions || []).some(
            reaction => Number(reaction.user_id) === currentUserId && reaction.emoji === emoji
        );

        socket.emit(mine ? 'message:reaction:remove' : 'message:reaction:add', {
            messageId,
            emoji
        });
    }, [messages, currentUserId]);

    const downloadFile = useCallback(async (file) => {
        if (!file?.id) return;

        const response = await chatApi.downloadFile(file.id);
        const blobUrl = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');

        link.href = blobUrl;
        link.download = file.file_name || 'download';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
    }, []);

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
        loadOlderMessages,
        hasMoreMessages,
        loadingOlder,
        toggleReaction,
        sendAttachment,
        downloadFile,
        editMessage,
        recallMessage,
        deleteMessageForMe,
        deleteMessageForEveryone,
        searchResults,
        searchUsers,
        startConversation,
        setTyping,
        refetchConversations: fetchConversations
    };
};