import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { chatApi } from '@/api/chatApi';
import { userApi } from '@/api/userApi';
import socket from '@/socket/socket.js';
import { toast } from 'sonner';

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
    const [messagePage, setMessagePage] = useState(1);
    const [isTyping, setIsTyping] = useState(false);
    const [onlineUserIds, setOnlineUserIds] = useState(new Set());
    const [conversationMembers, setConversationMembers] = useState([]);

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
        setConversationMembers([]);

        if (currentUserId > 0) {
            fetchConversations();
        }
    }, [currentUserId, fetchConversations]);

    useEffect(() => {
        if (!activeId) {
            setMessages([]);
            setConversationMembers([]);
            return;
        }

        let cancelled = false;

        const loadMessages = async () => {
            setLoading(true);
            try {
                const res = await chatApi.getMessages(activeId, 1, 50);
                if (cancelled) return;

                setMessages(res.data?.data || []);
                const membersResponse = await chatApi.getConversationMembers(activeId);
                if (cancelled) return;
                setConversationMembers(membersResponse.data?.data || []);
                setHasMoreMessages(Boolean(res.data?.pagination?.hasMore));
                setMessagePage(1);
                await chatApi.markAsRead(activeId);
                await chatApi.updateConversationSettings(activeId, 'unread', false);
                if (socket.connected) socket.emit('message:read', { conversationId: activeId });

                setConversations(prev => prev.map(c =>
                    Number(c.id) === Number(activeId)
                        ? { ...c, unreadCount: 0, markedUnread: false }
                        : c
                ));

                if (socket.connected) {
                    socket.emit('conversation:join', { conversationId: activeId });
                }
            } catch (error) {
                console.error('Lỗi lấy tin nhắn:', error);

                if (error?.response?.status === 403 || error?.response?.status === 404) {
                    socket.emit('conversation:leave', { conversationId: activeId });
                    setMessages([]);
                    setConversationMembers([]);
                    setActiveId(null);
                    toast.error('Bạn không còn quyền truy cập nhóm này');
                }
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

    const refreshConversationMembers = useCallback(async (conversationId = activeId) => {
        if (!conversationId) return [];

        try {
            const res = await chatApi.getConversationMembers(conversationId);
            const members = res.data?.data || [];
            setConversationMembers(members);
            return members;
        } catch (error) {
            console.error('Lỗi lấy thành viên conversation:', error);
            setConversationMembers([]);
            return [];
        }
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
                    // The sender receives the same Socket.IO event that the
                    // REST request also confirms. Reconcile the optimistic
                    // placeholder instead of appending a second message.
                    const optimisticIndex = prev.findIndex(item =>
                        String(item.id).startsWith('temp-') &&
                        Number(item.sender_id ?? item.senderId) === Number(currentUserId) &&
                        String(item.content ?? '') === String(message.content ?? '') &&
                        (item.status === 'sending' || item.status === 'uploading' || item.status === 'processing')
                    );

                    if (optimisticIndex !== -1) {
                        const next = [...prev];
                        next[optimisticIndex] = { ...message, status: 'sent' };
                        return next;
                    }

                    if (prev.some(item => Number(item.id) === Number(message.id))) {
                        return prev;
                    }

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

        const handleConversationUpdated = async ({ conversationId, lastMessage, senderId, updatedAt, action, member, conversation }) => {
            const sameConversation = Number(conversationId) === Number(activeId);
            const memberId = Number(member?.user_id);

            // Khi chính mình bị kick/rời nhóm, đóng conversation ngay lập tức.
            // Không gọi refresh members trước vì request đó sẽ 403 sau khi bị remove.
            if ((action === 'member-removed' || action === 'member-left')
                && memberId === currentUserId
                && sameConversation) {
                closeRemovedGroup(
                    conversationId,
                    action === 'member-removed'
                        ? 'Bạn đã bị xóa khỏi nhóm'
                        : 'Bạn đã rời nhóm'
                );
                await fetchConversations();
                return;
            }

            if (action === 'member-added' || action === 'member-removed' || action === 'member-left') {
                if (sameConversation) {
                    await refreshConversationMembers(conversationId);
                }
                await fetchConversations();
                return;
            }

            if (action === 'member-role-updated') {
                // Apply the role change immediately from the realtime event.
                // The next fetch is only for conversation-list metadata.
                if (sameConversation && member?.user_id != null) {
                    setConversationMembers(prev => prev.map(item =>
                        Number(item.user_id) === memberId
                            ? { ...item, ...member }
                            : item
                    ));
                }
                await fetchConversations();
                return;
            }

            if (conversation) {
                await fetchConversations();
                if (Number(conversationId) === Number(activeId)) {
                    await refreshConversationMembers(conversationId);
                }
                return;
            }

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
                    if (!reaction?.id) return item;

                    // Backend guarantees one reaction/user/message.
                    // Remove the user's previous reaction before adding the new one.
                    const nextReactions = reactions.filter(
                        r => Number(r.user_id) !== Number(reaction.user_id)
                    );

                    if (nextReactions.some(r => Number(r.id) === Number(reaction.id))) {
                        return { ...item, reactions: nextReactions };
                    }

                    return {
                        ...item,
                        reactions: [...nextReactions, reaction]
                    };
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

        const handleMessageFileDeleted = ({ messageId, conversationId, fileId }) => {
            if (Number(conversationId) !== Number(activeId)) return;

            setMessages(prev => prev.map(item =>
                Number(item.id) === Number(messageId)
                    ? {
                        ...item,
                        files: (item.files || []).filter(file => Number(file.id) !== Number(fileId))
                    }
                    : item
            ));
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

        const handlePresenceOffline = ({ userId, lastSeenAt = null }) => {
            const id = Number(userId);
            if (!Number.isInteger(id)) return;

            setOnlineUserIds(prev => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
            });

            setConversations(prev => prev.map(c =>
                Number(c.userId) === id
                    ? {
                        ...c,
                        isOnline: false,
                        lastSeenAt: lastSeenAt || c.lastSeenAt || null
                    }
                    : c
            ));
        };

        const closeRemovedGroup = (conversationId, message) => {
            if (Number(conversationId) !== Number(activeId)) return false;

            socket.emit('conversation:leave', { conversationId });
            setMessages([]);
            setConversationMembers([]);
            setIsTyping(false);
            setActiveId(null);
            toast.error(message || 'Bạn không còn quyền truy cập nhóm');
            return true;
        };

        const handleMemberAdded = async ({ conversationId }) => {
            await fetchConversations();
            if (Number(conversationId) === Number(activeId)) {
                await refreshConversationMembers(conversationId);
            }
        };

        const handleMemberRemoved = async ({ conversationId, member, message }) => {
            const removedUserId = Number(member?.user_id);
            const isMe = removedUserId === currentUserId;

            if (isMe) {
                closeRemovedGroup(conversationId, message || 'Bạn đã bị xóa khỏi nhóm');
                await fetchConversations();
                return;
            }

            if (Number(conversationId) === Number(activeId)) {
                await refreshConversationMembers(conversationId);
            }
            await fetchConversations();
        };

        const handleMemberLeft = async ({ conversationId, member, message }) => {
            if (Number(member?.user_id) === currentUserId) {
                closeRemovedGroup(conversationId, message || 'Bạn đã rời nhóm');
                await fetchConversations();
                return;
            }

            if (Number(conversationId) === Number(activeId)) {
                await refreshConversationMembers(conversationId);
            }
            await fetchConversations();
        };

        const handleMemberRoleUpdated = async ({ conversationId }) => {
            if (Number(conversationId) === Number(activeId)) {
                await refreshConversationMembers(conversationId);
            }
            await fetchConversations();
        };

        const handleConversationError = ({ code, conversationId, message }) => {
            if (code !== 'NOT_MEMBER') return;
            closeRemovedGroup(conversationId, message);
        };

        const handleConversationCreated = () => {
            fetchConversations();
        };

        socket.on('connect', handleSocketConnect);
        socket.on('presence:snapshot', handlePresenceSnapshot);
        socket.on('conversation:created', handleConversationCreated);
        socket.on('member:added', handleMemberAdded);
        socket.on('member:removed', handleMemberRemoved);
        socket.on('member:left', handleMemberLeft);
        socket.on('member:role-updated', handleMemberRoleUpdated);
        socket.on('conversation:error', handleConversationError);
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
        socket.on('message:file:deleted', handleMessageFileDeleted);
        socket.on('message:error', handleMessageError);

        return () => {
            socket.off('connect', handleSocketConnect);
            socket.off('presence:snapshot', handlePresenceSnapshot);
            socket.off('conversation:created', handleConversationCreated);
            socket.off('member:added', handleMemberAdded);
            socket.off('member:removed', handleMemberRemoved);
            socket.off('member:left', handleMemberLeft);
            socket.off('member:role-updated', handleMemberRoleUpdated);
            socket.off('conversation:error', handleConversationError);
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
            socket.off('message:file:deleted', handleMessageFileDeleted);
            socket.off('message:error', handleMessageError);
        };
    }, [activeId, fetchConversations, currentUserId, refreshConversationMembers]);

    const searchMessages = useCallback(async (query) => {
        if (!activeId || !query?.trim()) return [];
        const res = await chatApi.searchMessages(activeId, query.trim());
        return res.data?.data || [];
    }, [activeId]);

    const updateConversationSettings = useCallback(async (action, value) => {
        if (!activeId) return null;
        const res = await chatApi.updateConversationSettings(activeId, action, value);
        const settings = res.data?.data;

        setConversations(prev => prev.map(item =>
            Number(item.id) === Number(activeId)
                ? {
                    ...item,
                    ...(settings ? {
                        isPinned: Boolean(settings.pinned),
                        mutedUntil: settings.muted_until || null,
                        markedUnread: Boolean(settings.marked_unread)
                    } : {})
                }
                : item
        ));

        if (action === 'hide' && value) {
            setActiveId(null);
            setMessages([]);
            setConversationMembers([]);
        }

        return settings;
    }, [activeId]);

    const blockUser = useCallback(async (targetUserId) => {
        if (!activeId || !targetUserId) return;
        await chatApi.blockUser(activeId, targetUserId);
        setConversations(prev => prev.filter(item => Number(item.id) !== Number(activeId)));
        setActiveId(null);
        setMessages([]);
        setConversationMembers([]);
    }, [activeId]);

    const unblockUser = useCallback(async (targetUserId) => {
        if (!activeId || !targetUserId) return;
        return chatApi.unblockUser(activeId, targetUserId);
    }, [activeId]);

    const reportConversation = useCallback(async (targetUserId, reason, details = null) => {
        if (!activeId || !targetUserId) return;
        return chatApi.reportConversation(activeId, targetUserId, reason, details);
    }, [activeId]);

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

        const tempId = `temp-file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const placeholder = `📎 ${file.name}`;

        const optimisticMessage = {
            id: tempId,
            tempId,
            conversation_id: activeId,
            sender_id: currentUserId,
            content: placeholder,
            created_at: new Date().toISOString(),
            status: 'uploading',
            uploadProgress: 0,
            files: [{
                id: `temp-file-${Date.now()}`,
                file_name: file.name,
                file_size: file.size,
                mime_type: file.type,
                uploadStatus: 'uploading',
                uploadProgress: 0
            }]
        };

        setMessages(prev => [...prev, optimisticMessage]);

        try {
            const messageResponse = await chatApi.sendMessage(activeId, placeholder);
            const message = messageResponse.data?.data;

            if (!message?.id) throw new Error('Không tạo được message cho file');

            setMessages(prev => prev.map(item =>
                item.tempId === tempId
                    ? { ...message, status: 'uploading', uploadProgress: 0 }
                    : item
            ));

            const uploadResponse = await chatApi.uploadFile(
                message.id,
                file,
                progressEvent => {
                    const total = progressEvent.total || file.size;
                    const progress = Math.min(100, Math.round((progressEvent.loaded / total) * 100));

                    setMessages(prev => prev.map(item =>
                        Number(item.id) === Number(message.id)
                            ? {
                                ...item,
                                status: progress >= 100 ? 'processing' : 'uploading',
                                uploadProgress: progress,
                                files: [{
                                    id: `temp-upload-${message.id}`,
                                    file_name: file.name,
                                    file_size: file.size,
                                    mime_type: file.type,
                                    uploadStatus: progress >= 100 ? 'processing' : 'uploading',
                                    uploadProgress: progress
                                }]
                            }
                            : item
                    ));
                }
            );

            const uploadedFile = uploadResponse.data?.file;

            setMessages(prev => prev.map(item =>
                Number(item.id) === Number(message.id)
                    ? {
                        ...item,
                        status: 'sent',
                        uploadProgress: 100,
                        files: uploadedFile ? [uploadedFile] : item.files
                    }
                    : item
            ));

            return uploadedFile;
        } catch (error) {
            setMessages(prev => prev.map(item =>
                item.tempId === tempId || Number(item.id) === Number(tempId)
                    ? { ...item, status: 'failed', uploadProgress: 0 }
                    : item
            ));
            throw error;
        }
    }, [activeId, currentUserId]);

    const sendMessage = useCallback(async (content, replyToMessageId = null) => {
        const text = typeof content === 'string' ? content.trim() : '';
        if (!activeId || !text) return;

        const tempId = `temp-message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const optimisticMessage = {
            id: tempId,
            tempId,
            conversation_id: activeId,
            sender_id: currentUserId,
            content: text,
            reply_to_message_id: replyToMessageId,
            created_at: new Date().toISOString(),
            status: 'sending',
            is_read: false
        };

        setMessages(prev => [...prev, optimisticMessage]);

        try {
            // REST là nguồn xác nhận message chính; Socket.IO vẫn dùng để realtime
            // cho người nhận. Khi socket event quay lại, duplicate sẽ bị bỏ qua.
            const res = await chatApi.sendMessage(activeId, text, replyToMessageId);
            const saved = res.data?.data;

            if (!saved?.id) throw new Error('Server không trả về message');

            setMessages(prev => prev.map(item =>
                item.tempId === tempId
                    ? { ...saved, status: 'sent' }
                    : item
            ));
        } catch (error) {
            setMessages(prev => prev.map(item =>
                item.tempId === tempId
                    ? { ...item, status: 'failed' }
                    : item
            ));
            console.error('Không thể gửi message:', error);
        }
    }, [activeId, currentUserId]);

    const loadOlderMessages = useCallback(async () => {
        if (!activeId || loadingOlder || !hasMoreMessages) return;

        setLoadingOlder(true);
        try {
            const nextPage = messagePage + 1;
            const res = await chatApi.getMessages(activeId, nextPage, 50);
            const older = res.data?.data || [];

            setMessages(prev => {
                const existing = new Set(prev.map(item => Number(item.id)));
                const uniqueOlder = older.filter(item => !existing.has(Number(item.id)));
                return [...uniqueOlder, ...prev];
            });

            setHasMoreMessages(Boolean(res.data?.pagination?.hasMore));
            setMessagePage(nextPage);
        } catch (error) {
            console.error('Không thể tải thêm messages:', error);
        } finally {
            setLoadingOlder(false);
        }
    }, [activeId, loadingOlder, hasMoreMessages, messagePage]);

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

    const deleteFile = useCallback(async (file) => {
        if (!file?.id) return;

        try {
            await chatApi.deleteFile(file.id);
            setMessages(prev => prev.map(item =>
                Array.isArray(item.files)
                    ? { ...item, files: item.files.filter(existing => Number(existing.id) !== Number(file.id)) }
                    : item
            ));
        } catch (error) {
            console.error('Không thể xoá file:', error);
        }
    }, []);

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

    const previewFile = useCallback(async (file) => {
        if (!file?.id) return null;
        const response = await chatApi.downloadFile(file.id);
        return window.URL.createObjectURL(response.data);
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

    const startGroupConversation = useCallback(async (name, memberIds) => {
        const res = await chatApi.createGroupConversation(name, memberIds);
        const conversation = res.data?.data;

        await fetchConversations();
        if (conversation?.id) setActiveId(conversation.id);

        return conversation;
    }, [fetchConversations]);

    const updateGroupConversation = useCallback(async (name, avatarUrl = null) => {
        if (!activeId || !name?.trim()) return;

        const res = await chatApi.updateGroupConversation(
            activeId,
            name.trim(),
            avatarUrl
        );

        await fetchConversations();
        await refreshConversationMembers(activeId);
        return res.data?.data;
    }, [activeId, fetchConversations, refreshConversationMembers]);

    const addGroupMember = useCallback(async (userId) => {
        if (!activeId || !userId) return;

        const res = await chatApi.addGroupMember(activeId, userId);
        await refreshConversationMembers(activeId);
        await fetchConversations();

        return res.data?.data;
    }, [activeId, fetchConversations, refreshConversationMembers]);

    const removeGroupMember = useCallback(async (userId) => {
        if (!activeId || !userId) return;

        const res = await chatApi.removeGroupMember(activeId, userId);
        await refreshConversationMembers(activeId);
        await fetchConversations();

        return res.data?.data;
    }, [activeId, fetchConversations, refreshConversationMembers]);

    const leaveGroup = useCallback(async () => {
        if (!activeId) return;

        await chatApi.leaveGroup(activeId);
        setConversationMembers([]);
        setActiveId(null);
        await fetchConversations();
    }, [activeId, fetchConversations]);

    const updateGroupMemberRole = useCallback(async (userId, role) => {
        if (!activeId || !userId || !role) return;

        const res = await chatApi.updateGroupMemberRole(activeId, userId, role);
        await refreshConversationMembers(activeId);
        await fetchConversations();

        return res.data?.data;
    }, [activeId, fetchConversations, refreshConversationMembers]);

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
        conversationMembers,
        setActiveId,
        addGroupMember,
        removeGroupMember,
        leaveGroup,
        updateGroupMemberRole,
        updateGroupConversation,
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
        previewFile,
        deleteFile,
        editMessage,
        recallMessage,
        deleteMessageForMe,
        deleteMessageForEveryone,
        searchResults,
        searchUsers,
        startConversation,
        startGroupConversation,
        setTyping,
        updateConversationSettings,
        blockUser,
        unblockUser,
        reportConversation,
        searchMessages,
        refetchConversations: fetchConversations
    };
};