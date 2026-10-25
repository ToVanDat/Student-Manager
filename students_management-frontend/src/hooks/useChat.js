import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { chatApi } from '@/api/chatApi';
import { callApi } from '@/api/callApi';
import { userApi } from '@/api/userApi';
import socket from '@/socket/socket.js';
import { toast } from 'sonner';
import { e2eeRelayApi } from '@/api/e2eeRelayApi';
import { sendE2EEMessage, subscribeDecryptedE2EEMessages, setE2EEAttachmentConversationId, uploadE2EEAttachment, downloadE2EEAttachment } from '@/services/e2ee/e2eeClient';
import { loadE2EEHistory, saveE2EEHistoryMessage, deleteE2EEHistoryMessage } from '@/services/e2ee/e2eeHistoryStore';

export const useChat = () => {
    const { user } = useAuth();
    const currentUserId = Number(user?.id);
    const [conversations, setConversations] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [e2eeHistoryIssue, setE2EEHistoryIssue] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [messagePage, setMessagePage] = useState(1);
    const [isTyping, setIsTyping] = useState(false);
    const [onlineUserIds, setOnlineUserIds] = useState(new Set());
    const [conversationMembers, setConversationMembers] = useState([]);
    const [callHistory, setCallHistory] = useState([]);
    const searchJumpIdRef = useRef(null);
    const messageSearchRequestRef = useRef(0);
    const seenMessageEventIdsRef = useRef(new Set());
    const typingStateRef = useRef({ conversationId: null, lastSentAt: 0 });
    const readReceiptStateRef = useRef({ conversationId: null, lastSentAt: 0 });
    const remoteTypingTimerRef = useRef(null);
    const [searchJumpVersion, setSearchJumpVersion] = useState(0);

    // Bind SDK object-storage requests to the currently selected conversation.
    // The relay/API still independently verifies membership and E2EE status.
    useEffect(() => {
        setE2EEAttachmentConversationId(activeId);
        return () => setE2EEAttachmentConversationId(null);
    }, [activeId]);

    useEffect(() => subscribeDecryptedE2EEMessages(async decrypted => {
        const parseObject = value => {
            if (value && typeof value === 'object' && !Array.isArray(value)) return value;
            if (typeof value !== 'string') return null;
            try {
                const parsed = JSON.parse(value);
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
            } catch {
                return null;
            }
        };

        // SDK v11 delivers protocol content as JSON text. App-specific fields
        // must be carried inside DataMessageInput.body because the SDK drops
        // unknown top-level DataMessageInput properties.
        const protocolContent = parseObject(decrypted?.content);
        let payload = protocolContent || { type: 'message', body: String(decrypted?.content ?? '') };
        if (protocolContent?.dataMessage && typeof protocolContent.dataMessage === 'object') {
            const body = protocolContent.dataMessage.body;
            const applicationPayload = parseObject(body);
            payload = applicationPayload || { type: 'message', body: String(body ?? '') };
        }
        if (payload.dataMessage && typeof payload.dataMessage === 'object') {
            const dataMessage = payload.dataMessage;
            payload = parseObject(dataMessage.body) || {
                type: 'message',
                body: String(dataMessage.body ?? '')
            };
        } else if (!payload.type && typeof payload.body === 'string') {
            payload = parseObject(payload.body) || { type: 'message', body: payload.body };
        }
        const senderId = Number(decrypted?.senderId ?? decrypted?.senderUserId);
        const explicitConversationId = payload.conversationId ?? decrypted?.conversationId;
        const targetConversation = explicitConversationId != null
            ? conversations.find(item => String(item.id) === String(explicitConversationId))
            : conversations.find(item => item.type === 'direct' && Number(item.userId) === senderId);
        const conversationId = Number(explicitConversationId ?? targetConversation?.id);
        if (!Number.isSafeInteger(conversationId) || conversationId <= 0) return;
        if (payload.type === 'edit' && payload.targetMessageId) {
            const targetId = `e2ee:${String(payload.targetMessageId)}`;
            const target = messages.find(item => String(item.id) === targetId && Number(item.sender_id) === senderId)
                || (await loadE2EEHistory(currentUserId, conversationId)).find(item => String(item.id) === targetId && Number(item.sender_id) === senderId);
            if (target) {
                const updated = { ...target, content: String(payload.body || ''), is_edited: true };
                await saveE2EEHistoryMessage(currentUserId, updated);
                setMessages(previous => previous.map(item => String(item.id) === targetId ? updated : item));
            }
            return;
        }
        if (payload.type === 'recall' && payload.targetMessageId) {
            const targetId = `e2ee:${String(payload.targetMessageId)}`;
            const target = messages.find(item => String(item.id) === targetId && Number(item.sender_id) === senderId)
                || (await loadE2EEHistory(currentUserId, conversationId)).find(item => String(item.id) === targetId && Number(item.sender_id) === senderId);
            if (target) {
                const updated = { ...target, content: 'Tin nhắn đã được thu hồi', is_recalled: true };
                await saveE2EEHistoryMessage(currentUserId, updated);
                setMessages(previous => previous.map(item => String(item.id) === targetId ? updated : item));
            }
            return;
        }
        if (payload.type === 'reaction' && payload.targetMessageId && payload.emoji) {
            const targetId = `e2ee:${String(payload.targetMessageId)}`;
            const target = messages.find(item => String(item.id) === targetId)
                || (await loadE2EEHistory(currentUserId, conversationId)).find(item => String(item.id) === targetId);
            if (target) {
                const existingReactions = target.reactions || [];
                const alreadyReacted = existingReactions.some(reaction =>
                    Number(reaction.user_id) === senderId && reaction.emoji === payload.emoji
                );
                const reactions = payload.action === 'remove'
                    ? existingReactions.filter(reaction =>
                        !(Number(reaction.user_id) === senderId && reaction.emoji === payload.emoji)
                    )
                    : alreadyReacted
                        ? existingReactions
                        : [...existingReactions, { user_id: senderId, emoji: payload.emoji }];
                const updated = { ...target, reactions };
                await saveE2EEHistoryMessage(currentUserId, updated);
                setMessages(previous => previous.map(item => String(item.id) === targetId ? updated : item));
            }
            return;
        }
        if (payload.type !== 'message' && payload.type !== 'attachment') return;

        const messageId = `e2ee:${String(payload.appMessageId ?? decrypted?.messageId ?? decrypted?.id ?? Date.now())}`;
        const createdAt = new Date(decrypted?.timestamp ?? decrypted?.receivedAt ?? payload.timestamp ?? Date.now()).toISOString();
        const receivedMessage = {
            id: messageId,
            conversation_id: conversationId,
            sender_id: Number.isFinite(senderId) ? senderId : 0,
            content: payload.type === 'attachment' ? `📎 ${String(payload.fileName || 'Tệp đính kèm')}` : String(payload.body ?? ''),
            ...(payload.type === 'attachment' ? { files: [{ id: `e2ee-file:${String(payload.appMessageId ?? decrypted?.messageId ?? decrypted?.id ?? Date.now())}`, file_name: String(payload.fileName || 'attachment'), file_size: Number(payload.fileSize) || 0, mime_type: String(payload.mimeType || 'application/octet-stream'), _e2ee: true, _e2eePointer: payload.pointer }] } : {}),
            reply_to_message_id: payload.replyToMessageId ?? null,
            created_at: createdAt,
            status: 'sent',
            is_read: false,
            _e2ee: true
        };
        await saveE2EEHistoryMessage(currentUserId, receivedMessage);
        if (Number(activeId) !== conversationId) toast.info('Bạn có tin nhắn E2EE mới.');
        setMessages(previous => previous.some(item => String(item.id) === messageId)
            ? previous
            : Number(activeId) === conversationId ? [...previous, receivedMessage] : previous);
        setConversations(previous => previous.map(item => Number(item.id) === conversationId
            ? { ...item, lastMessage: receivedMessage.content, lastMessageAt: createdAt } : item));
    }), [activeId, conversations, messages, currentUserId]);

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
        setCallHistory([]);

        if (currentUserId > 0) {
            fetchConversations();
        }
    }, [currentUserId, fetchConversations]);

    useEffect(() => {
        clearTimeout(remoteTypingTimerRef.current);
        remoteTypingTimerRef.current = null;
        typingStateRef.current = { conversationId: null, lastSentAt: 0 };
        setIsTyping(false);

        if (!activeId) {
            setMessages([]);
            setConversationMembers([]);
            return;
        }

        let cancelled = false;
        setE2EEHistoryIssue(null);

        const loadMessages = async () => {
            setLoading(true);
            try {
                const res = await chatApi.getMessages(activeId, 1, 50);
                if (cancelled) return;

                const loadedMessages = res.data?.data || [];
                let localE2EEMessages = [];
                try {
                    localE2EEMessages = await loadE2EEHistory(currentUserId, activeId);
                    setE2EEHistoryIssue(null);
                } catch (historyError) {
                    setE2EEHistoryIssue({ conversationId: Number(activeId), code: historyError?.code || 'E2EE_HISTORY_UNAVAILABLE' });
                    toast.error('Không thể mở lịch sử E2EE trên thiết bị này. Có thể kho khóa cục bộ đã mất.', { duration: 8000 });
                    console.warn('[E2EE] local history unavailable', {
                        code: historyError?.code || 'E2EE_HISTORY_UNAVAILABLE'
                    });
                }
                if (cancelled) return;
                const seenMessageIds = new Set(loadedMessages.map(item => String(item.id)));
                const mergedMessages = [
                    ...loadedMessages,
                    ...localE2EEMessages.filter(item => !seenMessageIds.has(String(item.id)))
                ].sort((a, b) =>
                    (Date.parse(a.created_at || a.createdAt || '') || 0) -
                    (Date.parse(b.created_at || b.createdAt || '') || 0)
                );

                const callsResponse = await callApi.getHistory(100, 0, activeId);
                if (cancelled) return;
                const loadedCalls = (callsResponse.data?.data || []).map(call => ({
                    ...call,
                    id: `call:${call.call_id}`,
                    _timelineType: 'call'
                }));
                setCallHistory(loadedCalls);
                setMessages(mergedMessages);

                const membersResponse = await chatApi.getConversationMembers(activeId);
                if (cancelled) return;
                setConversationMembers(membersResponse.data?.data || []);
                setHasMoreMessages(Boolean(res.data?.pagination?.hasMore));
                setMessagePage(1);

                await chatApi.markAsRead(activeId);
                if (cancelled) return;
                await chatApi.updateConversationSettings(activeId, 'unread', false);
                if (cancelled) return;
                if (socket.connected) {
                    socket.emit('message:read', { conversationId: activeId });
                    readReceiptStateRef.current = { conversationId: Number(activeId), lastSentAt: Date.now() };
                }

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
                    toast.error('Bạn không còn quyền truy cập nhóm này', { duration: 8000 });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadMessages();

        return () => {
            cancelled = true;
            clearTimeout(remoteTypingTimerRef.current);
            remoteTypingTimerRef.current = null;
            if (socket.connected) {
                socket.emit('conversation:leave', { conversationId: activeId });
            }
            setIsTyping(false);
        };
    }, [activeId, currentUserId]);

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

    const hideCallHistory = useCallback(async (callId) => {
        try {
            await callApi.hideHistory(callId);
            setCallHistory(previous => previous.filter(call => String(call.call_id) !== String(callId)));
            // Hiding a call is per-user, so recalculate this user's sidebar preview.
            await fetchConversations();
            toast.success('Đã xóa cuộc gọi khỏi lịch sử của bạn', { duration: 3000 });
            return true;
        } catch (error) {
            console.error('Lỗi ẩn cuộc gọi khỏi lịch sử:', error);
            toast.error(error?.response?.data?.message || 'Không thể xóa cuộc gọi khỏi lịch sử', { duration: 8000 });
            return false;
        }
    }, []);

    const refreshCallHistory = useCallback(async (conversationId = activeId) => {
        if (!conversationId) return;
        try {
            const response = await callApi.getHistory(100, 0, conversationId);
            const calls = (response.data?.data || []).map(call => ({
                ...call,
                id: `call:${call.call_id}`,
                _timelineType: 'call'
            }));
            setCallHistory(calls);
        } catch (error) {
            console.error('Lỗi lấy lịch sử cuộc gọi:', error);
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

        const refreshCallsFromSocket = (activity = null) => {
            // Call state changes affect both the active timeline and the sidebar preview.
            void fetchConversations();
            if (
                !activity?.conversationId ||
                Number(activity.conversationId) === Number(activeId)
            ) {
                void refreshCallHistory();
            }
        };

        const handleNewMessage = (message) => {
            const conversationId = Number(message.conversation_id ?? message.conversationId);
            const messageId = message?.id == null ? null : String(message.id);
            const seenIds = seenMessageEventIdsRef.current;
            const isFirstDelivery = !messageId || !seenIds.has(messageId);

            if (messageId && isFirstDelivery) {
                seenIds.add(messageId);
                // Bound memory for long-lived tabs; IDs only deduplicate realtime deliveries.
                if (seenIds.size > 5000) {
                    const oldestId = seenIds.values().next().value;
                    seenIds.delete(oldestId);
                }
            }

            if (conversationId === Number(activeId)) {
                setMessages(prev => {
                    // The sender receives the same Socket.IO event that the
                    // REST request also confirms. Reconcile the optimistic
                    // placeholder instead of appending a second message.
                    const messageReplyId = message.reply_to_message_id ?? message.replyToMessageId ?? null;
                    const optimisticCandidates = prev
                        .map((item, index) => ({ item, index }))
                        .filter(({ item }) => {
                            const itemReplyId = item.reply_to_message_id ?? item.replyToMessageId ?? null;
                            return String(item.id).startsWith('temp-') &&
                                Number(item.sender_id ?? item.senderId) === Number(currentUserId) &&
                                String(item.content ?? '') === String(message.content ?? '') &&
                                String(itemReplyId ?? '') === String(messageReplyId ?? '') &&
                                ['sending', 'uploading', 'processing'].includes(item.status);
                        });

                    // Two identical messages can be sent close together. Match
                    // the server event to the pending item with the nearest
                    // creation time rather than always consuming the first one.
                    const optimisticMatch = optimisticCandidates.reduce((best, candidate) => {
                        if (!best) return candidate;
                        const eventTime = Date.parse(message.created_at ?? message.createdAt ?? '');
                        const candidateTime = Date.parse(candidate.item.created_at ?? candidate.item.createdAt ?? '');
                        const bestTime = Date.parse(best.item.created_at ?? best.item.createdAt ?? '');
                        if (!Number.isFinite(eventTime)) return best;
                        const candidateDistance = Number.isFinite(candidateTime)
                            ? Math.abs(eventTime - candidateTime)
                            : Number.POSITIVE_INFINITY;
                        const bestDistance = Number.isFinite(bestTime)
                            ? Math.abs(eventTime - bestTime)
                            : Number.POSITIVE_INFINITY;
                        return candidateDistance < bestDistance ? candidate : best;
                    }, null);

                    if (optimisticMatch) {
                        const next = [...prev];
                        next[optimisticMatch.index] = { ...message, status: 'sent' };
                        return next;
                    }

                    if (prev.some(item => Number(item.id) === Number(message.id))) {
                        return prev;
                    }

                    return [...prev, message];
                });
                if (Number(message.sender_id ?? message.senderId) !== Number(currentUserId)) {
                    chatApi.markAsRead(conversationId).then(() => {
                        if (!socket.connected) return;
                        const previous = readReceiptStateRef.current;
                        const now = Date.now();
                        // Coalesce bursts to stay below the socket read-event limit.
                        if (previous.conversationId !== conversationId || now - previous.lastSentAt >= 1000) {
                            socket.emit('message:read', { conversationId });
                            readReceiptStateRef.current = { conversationId, lastSentAt: now };
                        }
                    }).catch(() => {});
                }
            }

            setConversations(prev => {
                const next = prev.map(c => {
                    if (Number(c.id) !== conversationId) return c;

                    const incomingAt = Date.parse(message.created_at ?? message.createdAt ?? '');
                    const currentAt = Date.parse(c.lastMessageAt ?? '');
                    const incomingIsOlder =
                        Number.isFinite(incomingAt) &&
                        Number.isFinite(currentAt) &&
                        incomingAt < currentAt;

                    return {
                        ...c,
                        // An out-of-order message event must not overwrite a newer call preview.
                        ...(incomingIsOlder ? {} : {
                            lastMessage: message.content || 'Tin nhắn',
                            lastMessageAt: Number.isFinite(incomingAt)
                                ? new Date(incomingAt).toISOString()
                                : c.lastMessageAt
                        }),
                        unreadCount: Number(c.id) === Number(activeId) || Number(message.sender_id ?? message.senderId) === currentUserId
                            ? 0
                            : (c.unreadCount || 0) + (isFirstDelivery ? 1 : 0)
                    };
                });

                return next.sort((a, b) => {
                    const pinnedDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
                    if (pinnedDiff) return pinnedDiff;
                    const aTime = Date.parse(a.lastMessageAt ?? '') || 0;
                    const bTime = Date.parse(b.lastMessageAt ?? '') || 0;
                    return bTime - aTime;
                });
            });
        };

        const handleUserProfileUpdated = ({ userId, username, avatarUrl }) => {
            if (!userId) return;
            setConversations(previous => previous.map(item =>
                item.type === 'direct' && Number(item.userId) === Number(userId)
                    ? { ...item, name: username || item.name, avatar: avatarUrl || null }
                    : item
            ));
            setConversationMembers(previous => previous.map(member =>
                Number(member.user_id) === Number(userId)
                    ? { ...member, username: username || member.username, avatar: avatarUrl || null }
                    : member
            ));
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
                            lastMessage: lastMessage?.content || c.lastMessage || '',
                            lastMessageAt: updatedAt || c.lastMessageAt,
                            // message:new is the sole event that increments unreadCount.
                            // conversation:updated only refreshes preview metadata.
                            unreadCount: c.unreadCount
                        }
                        : c)
                    .sort((a, b) =>
                        new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
                    );
            });
        };

        const handleTypingStart = ({ conversationId }) => {
            if (Number(conversationId) !== Number(activeId)) return;
            setIsTyping(true);
            clearTimeout(remoteTypingTimerRef.current);
            // Recover the indicator if a typing:stop packet is lost during
            // a network handoff or the sender disconnects unexpectedly.
            remoteTypingTimerRef.current = setTimeout(() => setIsTyping(false), 5000);
        };

        const handleTypingStop = ({ conversationId }) => {
            if (Number(conversationId) !== Number(activeId)) return;
            clearTimeout(remoteTypingTimerRef.current);
            remoteTypingTimerRef.current = null;
            setIsTyping(false);
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
            toast.error(message || 'Bạn không còn quyền truy cập nhóm', { duration: 8000 });
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

        const handleConversationHistoryCleared = ({ conversationId }) => {
            if (Number(conversationId) === Number(activeId)) {
                setMessages([]);
                setCallHistory([]);
            }
            fetchConversations();
        };

        socket.on('connect', handleSocketConnect);
        socket.on('presence:snapshot', handlePresenceSnapshot);
        socket.on('conversation:created', handleConversationCreated);
        socket.on('conversation:history-cleared', handleConversationHistoryCleared);
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
        socket.on('call:incoming', refreshCallsFromSocket);
        socket.on('call:accepted', refreshCallsFromSocket);
        socket.on('call:connected', refreshCallsFromSocket);
        socket.on('call:timeout', refreshCallsFromSocket);
        socket.on('call:ended', refreshCallsFromSocket);
        socket.on('call:rejected', refreshCallsFromSocket);
        socket.on('call:activity:updated', refreshCallsFromSocket);
        socket.on('user:profile-updated', handleUserProfileUpdated);
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
            socket.off('conversation:history-cleared', handleConversationHistoryCleared);
            socket.off('member:added', handleMemberAdded);
            socket.off('member:removed', handleMemberRemoved);
            socket.off('member:left', handleMemberLeft);
            socket.off('member:role-updated', handleMemberRoleUpdated);
            socket.off('conversation:error', handleConversationError);
            socket.off('presence:online', handlePresenceOnline);
            socket.off('presence:offline', handlePresenceOffline);
            socket.off('message:new', handleNewMessage);
            socket.off('call:incoming', refreshCallsFromSocket);
            socket.off('call:accepted', refreshCallsFromSocket);
            socket.off('call:connected', refreshCallsFromSocket);
            socket.off('call:timeout', refreshCallsFromSocket);
            socket.off('call:ended', refreshCallsFromSocket);
            socket.off('call:rejected', refreshCallsFromSocket);
            socket.off('call:activity:updated', refreshCallsFromSocket);
            socket.off('user:profile-updated', handleUserProfileUpdated);
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
    }, [activeId, fetchConversations, currentUserId, refreshConversationMembers, refreshCallHistory]);

    useEffect(() => {
        // Ignore results that were requested for a conversation the user has left.
        messageSearchRequestRef.current += 1;
    }, [activeId]);

    const searchMessages = useCallback(async (query) => {
        if (!activeId) throw new Error('Chọn một cuộc trò chuyện trước khi tìm kiếm.');
        const normalizedQuery = String(query || '').trim();
        if (!normalizedQuery) return [];

        const requestId = ++messageSearchRequestRef.current;
        const conversationId = Number(activeId);
        const statusResponse = await e2eeRelayApi.getConversationStatus(conversationId);
        if (statusResponse.data?.data?.enabled && statusResponse.data?.data?.mode !== 'paused') {
            // Never send E2EE search terms or plaintext to the server. Search both
            // the current view and the device-local encrypted history store.
            const localHistory = await loadE2EEHistory(currentUserId, conversationId);
            if (requestId !== messageSearchRequestRef.current) return [];
            const allLocalMessages = new Map();
            for (const item of [...localHistory, ...messages]) {
                if (Number(item?.conversation_id) !== conversationId || item?._e2ee !== true) continue;
                allLocalMessages.set(String(item.id), item);
            }
            const needle = normalizedQuery.toLocaleLowerCase();
            return [...allLocalMessages.values()]
                .filter(item => String(item.content || '').toLocaleLowerCase().includes(needle))
                .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        }
        const res = await chatApi.searchMessages(conversationId, normalizedQuery);
        if (requestId !== messageSearchRequestRef.current) return [];

        const results = res.data?.data;
        if (!Array.isArray(results)) {
            throw new Error('Phản hồi tìm kiếm từ máy chủ không hợp lệ.');
        }
        return results;
    }, [activeId, messages, currentUserId]);

    const openSearchResult = useCallback((result) => {
        if (!result?.id) return;

        const targetId = String(result.id);
        searchJumpIdRef.current = targetId;
        setSearchJumpVersion(version => version + 1);

        setMessages(prev => {
            if (prev.some(item => String(item.id) === targetId)) return prev;
            return [...prev, result].sort(
                (a, b) => new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0)
            );
        });
    }, []);

    useEffect(() => {
        const targetId = searchJumpIdRef.current;
        if (!targetId) return;

        const node = Array.from(document.querySelectorAll('[data-message-id]'))
            .find(element => element.dataset.messageId === targetId);
        if (!node) return;

        searchJumpIdRef.current = null;
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        node.classList.add('ring-2', 'ring-blue-400', 'rounded-2xl');

        const timer = window.setTimeout(() => {
            node.classList.remove('ring-2', 'ring-blue-400', 'rounded-2xl');
        }, 1800);

        return () => window.clearTimeout(timer);
    }, [messages, searchJumpVersion]);

    const clearConversationMessages = useCallback(async () => {
        if (!activeId) throw new Error('Chưa chọn cuộc trò chuyện.');
        const conversationId = Number(activeId);
        const res = await chatApi.clearConversationMessages(conversationId);
        setMessages([]);
        setCallHistory([]);
        setConversations(prev => prev.map(item =>
            Number(item.id) === conversationId
                ? { ...item, lastMessage: '', lastMessageAt: null, unreadCount: 0, markedUnread: false }
                : item
        ).sort((a, b) => {
            const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
            if (pinDiff) return pinDiff;
            return (Date.parse(b.lastMessageAt ?? '') || 0) - (Date.parse(a.lastMessageAt ?? '') || 0);
        }));
        return res.data?.data;
    }, [activeId]);

    const updateConversationSettings = useCallback(async (action, value) => {
        if (!activeId) return null;
        const res = await chatApi.updateConversationSettings(activeId, action, value);
        const settings = res.data?.data;

        if (action === 'hide' && value) {
            setConversations(prev => prev.filter(item => Number(item.id) !== Number(activeId)));
            setActiveId(null);
            setMessages([]);
            setConversationMembers([]);
        } else {
            setConversations(prev => {
                const next = prev.map(item =>
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
                );
                // Apply pin/unpin ordering immediately without waiting for a refetch.
                return next.sort((a, b) => {
                    const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
                    if (pinDiff) return pinDiff;
                    const aTime = Date.parse(a.lastMessageAt ?? '') || 0;
                    const bTime = Date.parse(b.lastMessageAt ?? '') || 0;
                    return bTime - aTime;
                });
            });
            if (action === 'unread' && value) {
                setConversations(prev => prev.map(item =>
                    Number(item.id) === Number(activeId)
                        ? { ...item, unreadCount: Math.max(1, Number(item.unreadCount) || 0), markedUnread: true }
                        : item
                ));
            }
        }

        return settings;
    }, [activeId]);

    const blockUser = useCallback(async (targetUserId) => {
        if (!activeId || !targetUserId) throw new Error('Chưa chọn cuộc trò chuyện hoặc người dùng không hợp lệ.');
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
        if (!activeId || !targetUserId) throw new Error('Chưa chọn cuộc trò chuyện hoặc người dùng không hợp lệ.');
        return chatApi.reportConversation(activeId, targetUserId, reason, details);
    }, [activeId]);

    const editMessage = useCallback(async (messageId, content) => {
        const text = typeof content === 'string' ? content.trim() : '';
        if (!messageId || !text) return;
        const existing = messages.find(item => String(item.id) === String(messageId));
        if (existing?._e2ee) {
            if (Number(existing.sender_id) !== currentUserId) {
                toast.error('Chỉ người gửi mới có thể chỉnh sửa tin nhắn E2EE.', { duration: 8000 });
                return;
            }
            const conversation = conversations.find(item => Number(item.id) === Number(existing.conversation_id));
            if (!conversation?.userId) throw new Error('Không xác định được người nhận E2EE.');
            const targetMessageId = String(messageId).replace(/^e2ee:/, '');
            try {
                await sendE2EEMessage(conversation.userId, {
                    type: 'edit',
                    targetMessageId,
                    body: text,
                    conversationId: String(existing.conversation_id),
                    timestamp: Date.now()
                });
                const updatedLocal = { ...existing, content: text, is_edited: true };
                await saveE2EEHistoryMessage(currentUserId, updatedLocal);
                setMessages(previous => previous.map(item => String(item.id) === String(messageId)
                    ? updatedLocal : item));
            } catch (error) {
                toast.error('Không thể gửi thay đổi E2EE tới thiết bị người nhận.', { duration: 8000 });
                console.warn('[E2EE] edit control send failed', { code: error?.code || 'E2EE_EDIT_FAILED' });
            }
            return;
        }

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
    }, [messages, conversations, currentUserId]);

    const recallMessage = useCallback(async (messageId) => {
        if (!messageId) return;
        const existing = messages.find(item => String(item.id) === String(messageId));
        if (existing?._e2ee) {
            if (Number(existing.sender_id) !== currentUserId) {
                toast.error('Chỉ người gửi mới có thể thu hồi tin nhắn E2EE.', { duration: 8000 });
                return;
            }
            const conversation = conversations.find(item => Number(item.id) === Number(existing.conversation_id));
            if (!conversation?.userId) throw new Error('Không xác định được người nhận E2EE.');
            try {
                await sendE2EEMessage(conversation.userId, {
                    type: 'recall',
                    targetMessageId: String(messageId).replace(/^e2ee:/, ''),
                    conversationId: String(existing.conversation_id),
                    timestamp: Date.now()
                });
                const recalledLocal = { ...existing, content: 'Tin nhắn đã được thu hồi', is_recalled: true };
                await saveE2EEHistoryMessage(currentUserId, recalledLocal);
                setMessages(previous => previous.map(item => String(item.id) === String(messageId)
                    ? recalledLocal : item));
            } catch (error) {
                toast.error('Không thể gửi yêu cầu thu hồi E2EE tới thiết bị người nhận.', { duration: 8000 });
                console.warn('[E2EE] recall control send failed', { code: error?.code || 'E2EE_RECALL_FAILED' });
            }
            return;
        }

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
            toast.error(error?.response?.data?.message || 'Không thể thu hồi tin nhắn', { duration: 8000 });
        }
    }, [messages, conversations, currentUserId]);

    const deleteMessageForMe = useCallback(async (messageId) => {
        if (!messageId) return;
        const existing = messages.find(item => String(item.id) === String(messageId));
        if (existing?._e2ee) {
            await deleteE2EEHistoryMessage(currentUserId, messageId);
            setMessages(previous => previous.filter(item => String(item.id) !== String(messageId)));
            return;
        }

        try {
            await chatApi.deleteMessageForMe(messageId);
            setMessages(prev =>
                prev.filter(item => Number(item.id) !== Number(messageId))
            );
        } catch (error) {
            console.error('Không thể xoá message cho tôi:', error);
            toast.error(error?.response?.data?.message || 'Không thể xoá tin nhắn', { duration: 8000 });
        }
    }, [messages, currentUserId]);

    const deleteMessageForEveryone = useCallback(async (messageId) => {
        if (!messageId) return;
        const existing = messages.find(item => String(item.id) === String(messageId));
        if (existing?._e2ee) {
            if (Number(existing.sender_id) !== currentUserId) {
                toast.error('Chỉ người gửi mới có thể xóa tin nhắn E2EE cho mọi người.', { duration: 8000 });
                return;
            }
            const conversation = conversations.find(item => Number(item.id) === Number(existing.conversation_id));
            if (!conversation?.userId) throw new Error('Không xác định được người nhận E2EE.');
            try {
                await sendE2EEMessage(conversation.userId, {
                    type: 'recall',
                    targetMessageId: String(messageId).replace(/^e2ee:/, ''),
                    conversationId: String(existing.conversation_id),
                    timestamp: Date.now()
                });
                const recalledLocal = { ...existing, content: 'Tin nhắn đã được thu hồi', is_recalled: true };
                await saveE2EEHistoryMessage(currentUserId, recalledLocal);
                setMessages(previous => previous.map(item => String(item.id) === String(messageId)
                    ? recalledLocal : item));
            } catch (error) {
                toast.error('Không thể gửi yêu cầu xóa E2EE tới thiết bị người nhận.', { duration: 8000 });
                console.warn('[E2EE] delete-for-everyone send failed', { code: error?.code || 'E2EE_DELETE_FAILED' });
            }
            return;
        }

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
            toast.error(error?.response?.data?.message || 'Không thể xoá tin nhắn cho mọi người', { duration: 8000 });
        }
    }, [messages, conversations, currentUserId]);

    const sendAttachment = useCallback(async (file, quality = 'standard', onUploadProgress) => {
        if (!activeId || !file) return;
        const e2eeStatusResponse = await e2eeRelayApi.getConversationStatus(activeId);
        const e2eeStatus = e2eeStatusResponse.data?.data;
        if (!e2eeStatus || typeof e2eeStatus.available !== 'boolean') {
            const error = new Error('Không thể xác minh trạng thái bảo mật của cuộc trò chuyện. Tệp chưa được gửi.');
            error.code = 'E2EE_STATUS_UNVERIFIED';
            throw error;
        }
        if (e2eeStatus?.enabled && e2eeStatus?.mode !== 'paused') {
            const conversation = conversations.find(item => Number(item.id) === Number(activeId));
            if (conversation?.type !== 'direct' || !conversation?.userId) {
                toast.error('Tệp E2EE hiện chỉ hỗ trợ chat 1-1. Tệp chưa được gửi.', { duration: 8000 });
                return;
            }
            const tempId = `e2ee-file-${crypto.randomUUID()}`;
            const optimisticMessage = { id: tempId, tempId, conversation_id: activeId, sender_id: currentUserId, content: `📎 ${file.name}`, created_at: new Date().toISOString(), status: 'uploading', _e2ee: true, files: [{ id: `${tempId}:file`, file_name: file.name, file_size: file.size, mime_type: file.type || 'application/octet-stream', _e2ee: true, uploadStatus: 'uploading', uploadProgress: 0 }] };
            setMessages(prev => [...prev, optimisticMessage]);
            try {
                const pointer = await uploadE2EEAttachment(file, { onProgress: onUploadProgress });
                const appMessageId = crypto.randomUUID();
                await sendE2EEMessage(conversation.userId, { type: 'attachment', appMessageId, conversationId: String(activeId), timestamp: Date.now(), fileName: file.name, fileSize: file.size, mimeType: file.type || 'application/octet-stream', pointer });
                const finalMessage = { ...optimisticMessage, id: `e2ee:${appMessageId}`, tempId: undefined, status: 'sent', files: [{ id: `e2ee-file:${appMessageId}`, file_name: file.name, file_size: file.size, mime_type: file.type || 'application/octet-stream', _e2ee: true, _e2eePointer: pointer }] };
                await saveE2EEHistoryMessage(currentUserId, finalMessage);
                setMessages(prev => prev.map(item => item.tempId === tempId ? finalMessage : item));
                return finalMessage.files[0];
            } catch (error) {
                setMessages(prev => prev.map(item => item.tempId === tempId ? { ...item, status: 'failed' } : item));
                toast.error(error?.message || 'Không thể gửi tệp E2EE.', { duration: 8000 });
                throw error;
            }
        }

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
        let createdMessageId = null;

        try {
            const messageResponse = await chatApi.sendMessage(activeId, placeholder);
            const message = messageResponse.data?.data;

            if (!message?.id) throw new Error('Không tạo được message cho file');
            createdMessageId = message.id;

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
                    if (typeof onUploadProgress === 'function') {
                        onUploadProgress({ loaded: progressEvent.loaded, total, progress });
                    }

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
                },
                quality
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
                item.tempId === tempId ||
                (createdMessageId != null && Number(item.id) === Number(createdMessageId))
                    ? { ...item, status: 'failed', uploadProgress: 0 }
                    : item
            ));
            throw error;
        }
    }, [activeId, currentUserId, conversations]);

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
        let serverSendStartedAt = null;
        let serverSendAttempted = false;

        try {
            const statusResponse = await e2eeRelayApi.getConversationStatus(activeId);
            const e2eeStatus = statusResponse.data?.data;
            // A successful HTTP response with an unknown/malformed status is not
            // permission to downgrade to plaintext. The API explicitly returns
            // available=false only when the additive E2EE migration is absent.
            if (!e2eeStatus || typeof e2eeStatus.available !== 'boolean') {
                const error = new Error('Không thể xác minh trạng thái bảo mật của cuộc trò chuyện. Tin nhắn chưa được gửi.');
                error.code = 'E2EE_STATUS_UNVERIFIED';
                throw error;
            }
            if (e2eeStatus?.enabled && e2eeStatus?.mode !== 'paused') {
                const conversation = conversations.find(item => Number(item.id) === Number(activeId));
                if (conversation?.type !== 'direct' || !conversation?.userId) {
                    throw new Error('E2EE hiện chỉ hỗ trợ tin nhắn văn bản trong chat 1-1.');
                }
                const appMessageId = crypto.randomUUID();
                await sendE2EEMessage(conversation.userId, {
                    type: 'message',
                    appMessageId,
                    body: text,
                    conversationId: String(activeId),
                    timestamp: Date.now(),
                    replyToMessageId
                });
                const finalMessage = {
                    ...optimisticMessage,
                    id: `e2ee:${appMessageId}`,
                    status: 'sent',
                    _e2ee: true
                };
                try {
                    await saveE2EEHistoryMessage(currentUserId, finalMessage);
                } catch (historyError) {
                    toast.error('Tin nhắn đã gửi nhưng không thể lưu lịch sử E2EE cục bộ.', { duration: 8000 });
                    console.warn('[E2EE] sent message history save failed', {
                        code: historyError?.code || 'E2EE_HISTORY_SAVE_FAILED'
                    });
                }
                setMessages(prev => prev.map(item => item.tempId === tempId
                    ? finalMessage
                    : item));
                return;
            }

            // A missing migration returns available=false, preserving legacy chat.
            // If the status request itself fails, the catch path prevents plaintext fallback.
            serverSendAttempted = true;
            serverSendStartedAt = Date.now();
            const res = await chatApi.sendMessage(activeId, text, replyToMessageId);
            const saved = res.data?.data;
            if (!saved?.id) throw new Error('Server không trả về message');
            setMessages(prev => prev.map(item =>
                item.tempId === tempId ? { ...saved, status: 'sent' } : item
            ));
        } catch (error) {
            let reconciledMessage = null;
            // A timed-out HTTP response does not prove the server failed to save
            // the message. Re-read recent history before showing a false failure.
            if (serverSendAttempted) {
                try {
                    const historyResponse = await chatApi.getMessages(activeId, 1, 50);
                    const recentMessages = historyResponse.data?.data || [];
                    const candidates = recentMessages.filter(message => {
                        const createdAt = Date.parse(message.created_at ?? message.createdAt ?? '');
                        const messageReplyId = message.reply_to_message_id ?? message.replyToMessageId ?? null;
                        return Number(message.sender_id ?? message.senderId) === Number(currentUserId) &&
                            String(message.content ?? '') === text &&
                            String(messageReplyId ?? '') === String(replyToMessageId ?? '') &&
                            Number.isFinite(createdAt) &&
                            createdAt >= serverSendStartedAt - 10_000 &&
                            createdAt <= Date.now() + 10_000;
                    });
                    if (candidates.length) {
                        reconciledMessage = candidates.reduce((closest, candidate) => {
                            const distance = Math.abs(Date.parse(candidate.created_at ?? candidate.createdAt) - serverSendStartedAt);
                            const closestDistance = Math.abs(Date.parse(closest.created_at ?? closest.createdAt) - serverSendStartedAt);
                            return distance < closestDistance ? candidate : closest;
                        });
                    }
                } catch (reconcileError) {
                    console.warn('Không thể đối soát trạng thái gửi message:', reconcileError);
                }
            }

            if (reconciledMessage) {
                setMessages(prev => prev.map(item => item.tempId === tempId || String(item.id) === String(reconciledMessage.id)
                    ? { ...reconciledMessage, status: 'sent' }
                    : item));
            } else {
                setMessages(prev => prev.map(item =>
                    item.tempId === tempId
                        ? { ...item, status: 'failed' }
                        : item
                ));
                toast.error('Không thể xác nhận tin nhắn đã được gửi. Hãy kiểm tra kết nối trước khi gửi lại.', { duration: 8000 });
            }
            console.error('Không thể gửi message:', error);
        }
    }, [activeId, currentUserId, conversations]);

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
        if (!messageId || !emoji) return;
        const message = messages.find(item => String(item.id) === String(messageId) ||
            Number(item.id) === Number(messageId));
        const mine = (message?.reactions || []).some(
            reaction => Number(reaction.user_id) === currentUserId && reaction.emoji === emoji
        );

        if (message?._e2ee) {
            const conversation = conversations.find(item => Number(item.id) === Number(message.conversation_id));
            if (!conversation?.userId) return;
            const targetMessageId = String(messageId).replace(/^e2ee:/, '');
            try {
                await sendE2EEMessage(conversation.userId, {
                    type: 'reaction',
                    action: mine ? 'remove' : 'add',
                    targetMessageId,
                    emoji,
                    conversationId: String(message.conversation_id),
                    timestamp: Date.now()
                });
                const reactions = mine
                    ? (message.reactions || []).filter(reaction => !(Number(reaction.user_id) === currentUserId && reaction.emoji === emoji))
                    : [...(message.reactions || []), { user_id: currentUserId, emoji }];
                const updated = { ...message, reactions };
                await saveE2EEHistoryMessage(currentUserId, updated);
                setMessages(previous => previous.map(item => String(item.id) === String(messageId) ? updated : item));
            } catch (error) {
                toast.error('Không thể gửi phản ứng E2EE.', { duration: 8000 });
            }
            return;
        }
        if (!socket.connected) return;
        socket.emit(mine ? 'message:reaction:remove' : 'message:reaction:add', { messageId, emoji });
    }, [messages, currentUserId, conversations]);

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

    const getFileBlob = useCallback(async (file) => {
        if (file?._e2ee) {
            if (!file._e2eePointer) throw new Error('Thiếu pointer của tệp E2EE.');
            const decrypted = await downloadE2EEAttachment(file._e2eePointer);
            if (decrypted instanceof Blob) return decrypted;
            if (decrypted instanceof ArrayBuffer) return new Blob([decrypted], { type: file.mime_type || 'application/octet-stream' });
            if (ArrayBuffer.isView(decrypted)) return new Blob([decrypted], { type: file.mime_type || 'application/octet-stream' });
            if (decrypted?.data instanceof Uint8Array) return new Blob([decrypted.data], { type: file.mime_type || 'application/octet-stream' });
            throw new Error('SDK không trả về dữ liệu tệp đã giải mã hợp lệ.');
        }
        if (!file?.id) throw new Error('Tệp không hợp lệ.');
        // Optimistic upload placeholders are UI-only and must never be sent to
        // the numeric legacy download endpoint (e.g. temp-upload-136).
        if (typeof file.id === 'string' && /^(?:temp-|e2ee-file:)/i.test(file.id)) {
            throw new Error('Tệp vẫn đang tải lên hoặc chưa được lưu thành công. Hãy đợi upload hoàn tất rồi thử lại.');
        }
        if (!Number.isSafeInteger(Number(file.id)) || Number(file.id) <= 0) {
            throw new Error('ID tệp không hợp lệ. Tệp có thể chưa được tải lên thành công.');
        }
        const response = await chatApi.downloadFile(file.id);
        return response.data;
    }, [downloadE2EEAttachment]);

    const downloadFile = useCallback(async (file) => {
        if (!file?.id) return;
        const blob = await getFileBlob(file);
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = file.file_name || 'download';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
    }, [getFileBlob]);

    const previewFile = useCallback(async (file) => {
        if (!file?.id) return null;
        const blob = await getFileBlob(file);
        return window.URL.createObjectURL(blob);
    }, [getFileBlob]);

    const userSearchRequestRef = useRef(0);

    const searchUsers = useCallback(async (search) => {
        const requestId = ++userSearchRequestRef.current;
        const normalizedSearch = String(search || '').trim();

        if (!normalizedSearch) {
            setSearchResults([]);
            return;
        }

        try {
            const res = await userApi.searchForChat(normalizedSearch);
            // A slow response for an older query must not overwrite newer results.
            if (requestId !== userSearchRequestRef.current) return;
            setSearchResults(res.data?.data || []);
        } catch (error) {
            if (requestId !== userSearchRequestRef.current) return;
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
        const normalizedUserId = Number(targetUserId);
        if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
            throw new Error('Người dùng không hợp lệ');
        }

        const res = await chatApi.createDirectConversation(normalizedUserId);
        const conversation = res.data?.data;

        if (!conversation?.id) {
            throw new Error('Server không trả về conversation');
        }

        // Chuyển ngay sang conversation vừa tạo/lấy được.
        setActiveId(Number(conversation.id));

        // Đồng bộ sidebar sau khi conversation đã được chọn.
        await fetchConversations();

        return conversation;
    }, [fetchConversations]);

    const setTyping = useCallback((typing) => {
        if (!activeId || !socket.connected) return;

        const conversationId = Number(activeId);
        const state = typingStateRef.current;
        if (typing) {
            // MessageInput calls this on every keystroke. Send a start event
            // immediately, then at most one heartbeat every 2 seconds so the
            // server's per-event rate limit does not suppress active typing.
            if (state.conversationId !== conversationId || Date.now() - state.lastSentAt >= 2000) {
                socket.emit('typing:start', { conversationId: activeId });
                typingStateRef.current = { conversationId, lastSentAt: Date.now() };
            }
            return;
        }

        if (state.conversationId === conversationId) {
            socket.emit('typing:stop', { conversationId: activeId });
        }
        typingStateRef.current = { conversationId: null, lastSentAt: 0 };
    }, [activeId]);

    return {
        conversations,
        activeId,
        e2eeHistoryIssue,
        conversationMembers,
        setActiveId,
        addGroupMember,
        removeGroupMember,
        leaveGroup,
        updateGroupMemberRole,
        updateGroupConversation,
        messages,
        callHistory,
        hideCallHistory,
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
        clearConversationMessages,
        blockUser,
        unblockUser,
        reportConversation,
        searchMessages,
        openSearchResult,
        refetchConversations: fetchConversations
    };
};
