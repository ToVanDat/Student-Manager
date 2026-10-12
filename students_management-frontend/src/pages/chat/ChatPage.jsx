import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock3, LogOut, MoreVertical, Settings, UserRound, X } from 'lucide-react';

import ChatSidebar from '@/components/chat/ChatSidebar.jsx';
import ChatWindow from '@/components/chat/ChatWindow.jsx';
import EmptyChat from '@/components/chat/EmptyChat.jsx';
import useWebRTCCall from '@/hooks/useWebRTCCall.js';
import CallCenterPanel from '@/components/call/CallCenterPanel.jsx';
import { callApi } from '@/api/callApi.js';
import socket from '@/socket/socket.js';

import { useChat } from '@/hooks/useChat.js';
import { useAuth } from '@/hooks/useAuth.js';

export default function ChatPage() {
    const navigate = useNavigate();
    const { user, logoutUser, webRTCCall } = useAuth();
    const [callCenterOpen, setCallCenterOpen] = useState(false);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const accountMenuRef = useRef(null);
    const [callNotifications, setCallNotifications] = useState([]);
    const [unreadCallNotificationCount, setUnreadCallNotificationCount] = useState(0);
    const callNotificationIdsRef = useRef(new Set());

    useEffect(() => {
        if (!user?.id) {
            setCallNotifications([]);
            setUnreadCallNotificationCount(0);
            callNotificationIdsRef.current.clear();
            return undefined;
        }

        let cancelled = false;
        callApi.getNotifications()
            .then(response => {
                if (cancelled) return;
                const loaded = response.data?.data || [];
                loaded.forEach(item => callNotificationIdsRef.current.add(String(item.id)));
                if (Number.isFinite(Number(response.data?.unreadCount))) {
                    setUnreadCallNotificationCount(Number(response.data.unreadCount));
                } else {
                    setUnreadCallNotificationCount(loaded.filter(item => !item.is_read).length);
                }
                setCallNotifications(previous => {
                    const loadedIds = new Set(loaded.map(item => String(item.id)));
                    const receivedWhileLoading = previous.filter(item => !loadedIds.has(String(item.id)));
                    return [...receivedWhileLoading, ...loaded];
                });
            })
            .catch(error => console.error('Không thể tải thông báo cuộc gọi:', error));

        const handleCallNotification = notification => {
            if (!notification?.id) return;
            const notificationId = String(notification.id);
            const isNewNotification = !callNotificationIdsRef.current.has(notificationId);
            callNotificationIdsRef.current.add(notificationId);
            if (isNewNotification && !notification.is_read) {
                setUnreadCallNotificationCount(count => count + 1);
            }
            setCallNotifications(previous => [
                notification,
                ...previous.filter(item => String(item.id) !== notificationId)
            ]);
        };
        socket.on('call:notification', handleCallNotification);

        return () => {
            cancelled = true;
            socket.off('call:notification', handleCallNotification);
        };
    }, [user?.id]);

    useEffect(() => {
        if (!accountMenuOpen) return undefined;
        const handleOutsideClick = event => {
            if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
                setAccountMenuOpen(false);
            }
        };
        const handleEscape = event => {
            if (event.key === 'Escape') setAccountMenuOpen(false);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [accountMenuOpen]);

    const markCallNotificationRead = async notificationId => {
        await callApi.markNotificationRead(notificationId);
        setCallNotifications(previous => previous.map(item =>
            String(item.id) === String(notificationId) ? { ...item, is_read: true } : item
        ));
        setUnreadCallNotificationCount(count => {
            const wasUnread = callNotifications.some(item =>
                String(item.id) === String(notificationId) && !item.is_read
            );
            return wasUnread ? Math.max(0, count - 1) : count;
        });
    };

    const {
        conversations,
        activeId,
        setActiveId,
        messages,
        callHistory,
        hideCallHistory,
        conversationMembers,
        onlineUserIds,
        sendMessage,
        sendAttachment,
        downloadFile,
        previewFile,
        deleteFile,
        isTyping,
        searchResults,
        searchUsers,
        startConversation,
        startGroupConversation,
        addGroupMember,
        removeGroupMember,
        leaveGroup,
        updateGroupMemberRole,
        updateGroupConversation,
        setTyping,
        editMessage,
        recallMessage,
        deleteMessageForMe,
        deleteMessageForEveryone,
        loadOlderMessages,
        hasMoreMessages,
        loadingOlder,
        toggleReaction,
        updateConversationSettings,
        blockUser,
        unblockUser,
        reportConversation,
        searchMessages,
        openSearchResult
    } = useChat();

    const timelineMessages = (() => {
        // Merge the REST message page and call history without duplicating a call
        // if a future API/socket path also exposes it as a timeline event.
        const seenCallIds = new Set();
        // Put call-history records first so a duplicate call-shaped message cannot replace the call card.
        const combined = [...callHistory, ...messages].filter(item => {
            const callId = item.call_id ?? (
                item._timelineType === 'call' && String(item.id).startsWith('call:')
                    ? String(item.id).slice(5)
                    : null
            );
            if (callId == null) return true;
            const key = String(callId);
            if (seenCallIds.has(key)) return false;
            seenCallIds.add(key);
            return true;
        });

        const getTimelineTimestamp = item => {
            const value = item._timelineType === 'call'
                ? (item.ended_at ?? item.updated_at ?? item.started_at)
                : (item.created_at ?? item.createdAt);
            if (value == null || value === '') return 0;
            const timestamp = Date.parse(value);
            return Number.isFinite(timestamp) ? timestamp : 0;
        };

        const sorted = combined.sort((a, b) =>
            getTimelineTimestamp(a) - getTimelineTimestamp(b)
        );

        const getDateKey = value => {
            const date = new Date(value);
            return Number.isNaN(date.getTime())
                ? ''
                : `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        };

        const formatDateLabel = value => {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '';
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            const sameDay = (a, b) =>
                a.getFullYear() === b.getFullYear() &&
                a.getMonth() === b.getMonth() &&
                a.getDate() === b.getDate();

            if (sameDay(date, today)) return 'Hôm nay';
            if (sameDay(date, yesterday)) return 'Hôm qua';

            return date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric'
            });
        };

        const result = [];
        let previousDateKey = null;

        sorted.forEach(item => {
            const value = item._timelineType === 'call'
                ? (item.ended_at ?? item.updated_at ?? item.started_at)
                : (item.created_at ?? item.createdAt);
            const dateKey = getDateKey(value);

            if (dateKey && dateKey !== previousDateKey) {
                result.push({
                    id: `timeline-date:${dateKey}`,
                    _timelineType: 'date',
                    dateLabel: formatDateLabel(value)
                });
                previousDateKey = dateKey;
            }

            result.push(item);
        });

        return result;
    })();

    const activeConversation = conversations.find(
        conversation => Number(conversation.id) === Number(activeId)
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6">
                <button
                    type="button"
                    onClick={() => navigate('/students')}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Quay lại Giao diện Quản lý"
                >
                    <span aria-hidden="true">←</span>
                    <span className="hidden sm:inline">Quản lý</span>
                </button>
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-teal-600 text-white">
                        <span className="text-lg" aria-hidden="true">✉</span>
                    </div>
                    <div className="min-w-0">
                        <h1 className="truncate text-sm font-bold">Giao diện Chat</h1>
                        <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">Trò chuyện và kết nối realtime</p>
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setCallCenterOpen(true)}
                        className="relative inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        aria-label="Lịch sử cuộc gọi và thông báo"
                        title="Lịch sử cuộc gọi"
                    >
                        <Clock3 size={18} />
                        {unreadCallNotificationCount > 0 && (
                            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-5 text-white">{unreadCallNotificationCount > 99 ? '99+' : unreadCallNotificationCount}</span>
                        )}
                    </button>
                    <div className="relative" ref={accountMenuRef}>
                        <button
                            type="button"
                            onClick={() => setAccountMenuOpen(open => !open)}
                            aria-expanded={accountMenuOpen}
                            aria-haspopup="menu"
                            aria-label="Mở menu tài khoản"
                            className="flex max-w-[220px] items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:hover:bg-slate-800 sm:gap-3 sm:px-3"
                        >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-100">{user?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
                            <span className="hidden min-w-0 text-left sm:block">
                                <span className="block max-w-28 truncate text-xs font-semibold">{user?.username || 'Người dùng'}</span>
                                <span className="block text-[10px] text-slate-500 dark:text-slate-400">{user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}</span>
                            </span>
                            <MoreVertical size={17} className="shrink-0 text-slate-500" />
                        </button>
                        {accountMenuOpen && (
                            <div role="menu" className="absolute right-0 top-full z-[190] mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                <div className="flex items-center gap-3 px-3 py-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-100">{user?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold">{user?.username || 'Người dùng'}</span>
                                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{user?.email || 'Chưa cập nhật email'}</span>
                                        <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}</span>
                                    </span>
                                </div>
                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); navigate('/students'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><ArrowLeft size={17} /><span>Về trang quản lý</span></button>
                                <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); navigate('/students?view=settings'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><UserRound size={17} /><span>Thông tin & tài khoản</span></button>
                                <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); navigate('/students?view=settings'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><Settings size={17} /><span>Cài đặt & bảo mật</span></button>
                                <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); setCallCenterOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><Clock3 size={17} /><span>Lịch sử cuộc gọi</span>{unreadCallNotificationCount > 0 && <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] text-white">{unreadCallNotificationCount}</span>}</button>
                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); logoutUser(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"><LogOut size={17} /><span>Đăng xuất</span></button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <CallCenterPanel
                open={callCenterOpen}
                onClose={() => setCallCenterOpen(false)}
                currentUserId={Number(user?.id)}
                notifications={callNotifications}
                onMarkNotificationRead={markCallNotificationRead}
            />

            <main className="h-[calc(100vh-4rem)] min-h-0 p-2 sm:p-4 lg:p-6">
                <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex h-full min-h-0">
                        <ChatSidebar
                            conversations={conversations}
                            onlineUserIds={onlineUserIds}
                            onOpenCallCenter={() => setCallCenterOpen(true)}
                            callNotificationCount={unreadCallNotificationCount}
                            activeId={activeId}
                            onSelectConversation={setActiveId}
                            searchUsers={searchUsers}
                            searchResults={searchResults}
                            onStartConversation={startConversation}
                            onStartGroupConversation={startGroupConversation}
                        />

                        {activeId && activeConversation ? (
                            <ChatWindow
                                activeConversation={activeConversation}
                                messages={timelineMessages}
                                currentUserId={Number(user?.id)}
                                onSendMessage={sendMessage}
                                onSendAttachment={sendAttachment}
                                onDownloadFile={downloadFile}
                                onPreviewFile={previewFile}
                                onDeleteFile={deleteFile}
                                isTyping={isTyping}
                                onTyping={setTyping}
                                onEdit={editMessage}
                                onRecall={recallMessage}
                                onDeleteForMe={deleteMessageForMe}
                                onDeleteForEveryone={deleteMessageForEveryone}
                                onToggleReaction={toggleReaction}
                                conversationMembers={conversationMembers}
                                searchUsers={searchUsers}
                                searchResults={searchResults}
                                onAddGroupMember={addGroupMember}
                                onRemoveGroupMember={removeGroupMember}
                                onUpdateGroupMemberRole={updateGroupMemberRole}
                                onUpdateGroupConversation={updateGroupConversation}
                                onlineUserIds={onlineUserIds}
                                onLeaveGroup={leaveGroup}
                                hasMoreMessages={hasMoreMessages}
                                callState={webRTCCall.state}
                                call={webRTCCall.call}
                                onStartCall={webRTCCall.startCall}
                                onRedial={webRTCCall.startCall}
                                onHideCall={hideCallHistory}
                                onUpdateConversationSettings={updateConversationSettings}
                                onBlockUser={blockUser}
                                onUnblockUser={unblockUser}
                                onReportConversation={reportConversation}
                                onSearchMessages={searchMessages}
                                onOpenSearchResult={openSearchResult}
                                loadingOlder={loadingOlder}
                                onLoadOlder={loadOlderMessages}
                            />
                        ) : (
                            <EmptyChat
                                onStartConversation={() => {
                                    const newChatButton = document.querySelector('[data-new-chat]');
                                    newChatButton?.click();
                                }}
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
