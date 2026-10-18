import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock3, LogOut, MoreVertical, UserRound, GraduationCap, Home, MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import ChatSidebar from '@/components/chat/ChatSidebar.jsx';
import AvatarFallback from '@/components/chat/AvatarFallback.jsx';
import ChatWindow from '@/components/chat/ChatWindow.jsx';
import EmptyChat from '@/components/chat/EmptyChat.jsx';
import CallCenterPanel from '@/components/call/CallCenterPanel.jsx';
import { callApi } from '@/api/callApi.js';
import socket from '@/socket/socket.js';
import GlobalMoreMenu from '@/components/layout/GlobalMoreMenu.jsx';
import { toast } from 'sonner';
import { e2eeRelayApi } from '@/api/e2eeRelayApi';
import { useE2EEClient } from '@/hooks/useE2EEClient';
import E2EEDeviceLinkPanel from '@/components/chat/E2EEDeviceLinkPanel.jsx';

import { useChat } from '@/hooks/useChat.js';
import { useAuth } from '@/hooks/useAuth.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function ChatPage() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { user, logoutUser, webRTCCall } = useAuth();
    const e2eeClient = useE2EEClient();
    const [e2eeStatus, setE2eeStatus] = useState(null);
    const [enablingE2EE, setEnablingE2EE] = useState(false);
    const [callCenterOpen, setCallCenterOpen] = useState(() => new URLSearchParams(window.location.search).get('calls') === '1');
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [chatNavCollapsed, setChatNavCollapsed] = useState(false);
    const accountMenuRef = useRef(null);
    const [callNotifications, setCallNotifications] = useState([]);
    const [unreadCallNotificationCount, setUnreadCallNotificationCount] = useState(0);
    const callNotificationIdsRef = useRef(new Set());

    const closeCallCenter = () => {
        setCallCenterOpen(false);
        if (new URLSearchParams(window.location.search).has('calls')) {
            navigate('/chat', { replace: true });
        }
    };

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

    useEffect(() => {
        const requestedId = new URLSearchParams(window.location.search).get('conversationId');
        if (!requestedId || !conversations.length) return;
        const target = conversations.find(conversation => Number(conversation.id) === Number(requestedId));
        if (!target) return;
        setActiveId(target.id);
        navigate('/chat', { replace: true });
    }, [conversations, setActiveId, navigate]);

    const activeConversation = conversations.find(
        conversation => Number(conversation.id) === Number(activeId)
    );
    useEffect(() => {
        if (!activeId || !user?.id) {
            setE2eeStatus(null);
            return undefined;
        }
        let cancelled = false;
        e2eeRelayApi.getConversationStatus(activeId)
            .then(response => {
                if (!cancelled) setE2eeStatus(response.data?.data || null);
            })
            .catch(error => {
                if (!cancelled) {
                    setE2eeStatus(null);
                    console.warn('[E2EE] conversation status unavailable', {
                        code: error?.response?.data?.code || 'E2EE_STATUS_UNAVAILABLE'
                    });
                }
            });
        return () => { cancelled = true; };
    }, [activeId, user?.id, e2eeClient.status, e2eeClient.relayState]);

    const enableActiveConversationE2EE = async () => {
        if (!activeId || enablingE2EE) return;
        if (!e2eeClient.isLocalStoreReady || e2eeClient.relayState !== 'connected') {
            toast.error('Thiết bị này chưa sẵn sàng cho E2EE. Hãy kiểm tra kho khóa và kết nối relay.');
            return;
        }
        if (!e2eeStatus?.canEnable) {
            toast.error('Cần đăng ký khóa cho tất cả thiết bị của cả hai người trước khi bật E2EE.');
            return;
        }
        const confirmed = window.confirm(
            'Bật E2EE cho cuộc trò chuyện này? Tin nhắn cũ sẽ giữ nguyên; tin nhắn văn bản mới sẽ được mã hóa trên thiết bị. Tệp đính kèm E2EE chưa được hỗ trợ.'
        );
        if (!confirmed) return;
        setEnablingE2EE(true);
        try {
            const response = await e2eeRelayApi.enableConversation(activeId);
            setE2eeStatus(response.data?.data || { ...e2eeStatus, enabled: true });
            toast.success('Đã bật E2EE cho cuộc trò chuyện 1-1.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Không thể bật E2EE.');
        } finally {
            setEnablingE2EE(false);
        }
    };

    const totalUnreadMessages = conversations.reduce(
        (total, conversation) => total + Math.max(0, Number(conversation.unreadCount) || 0),
        0
    );

    return (
        <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f6f8fb] font-sans text-[#203754] dark:bg-slate-950 dark:text-slate-100">
            <header className="relative z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
                <button
                    type="button"
                    onClick={() => setChatNavCollapsed(value => !value)}
                    className="hidden size-9 shrink-0 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:inline-flex"
                    aria-label={chatNavCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
                    title={chatNavCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
                >
                    {chatNavCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
                </button>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setCallCenterOpen(true)}
                        className="relative inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700"
                        aria-label="Lịch sử cuộc gọi và thông báo"
                        title="Lịch sử cuộc gọi"
                    >
                        <Clock3 size={18} />
                        {unreadCallNotificationCount > 0 && (
                            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-5 text-white">{unreadCallNotificationCount > 99 ? '99+' : unreadCallNotificationCount}</span>
                        )}
                    </button>
                    <E2EEDeviceLinkPanel user={user} clientState={e2eeClient} />
                    <div className="relative" ref={accountMenuRef}>
                        <button
                            type="button"
                            onClick={() => setAccountMenuOpen(open => !open)}
                            aria-expanded={accountMenuOpen}
                            aria-haspopup="menu"
                            aria-label="Mở menu tài khoản"
                            className="flex max-w-[220px] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:gap-3 sm:px-3"
                        >
                            <AvatarFallback name={user?.username} src={user?.avatar_url || user?.avatarUrl || user?.avatar} size="sm" />
                            <span className="hidden min-w-0 text-left sm:block">
                                <span className="block max-w-28 truncate text-xs font-semibold">{user?.username || 'Người dùng'}</span>
                                <span className="block text-[10px] text-slate-500 dark:text-slate-400">{user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}</span>
                            </span>
                            <MoreVertical size={17} className="shrink-0 text-slate-500 dark:text-slate-400" />
                        </button>
                        {accountMenuOpen && (
                            <GlobalMoreMenu
                                user={user}
                                onSelectSettings={(tab) => {
                                    setAccountMenuOpen(false);
                                    navigate(`/students?view=settings&tab=${encodeURIComponent(tab)}`);
                                }}
                                onLogout={() => {
                                    setAccountMenuOpen(false);
                                    logoutUser();
                                }}
                            />
                        )}
                    </div>
                </div>
            </header>

            <CallCenterPanel
                open={callCenterOpen}
                onClose={closeCallCenter}
                currentUserId={Number(user?.id)}
                notifications={callNotifications}
                onMarkNotificationRead={markCallNotificationRead}
            />

            <main className="chat-workspace min-h-0 flex-1 overflow-hidden p-0 sm:p-3 lg:p-4">
                <div className="chat-shell h-full min-h-0 overflow-hidden rounded-none border-0 bg-white shadow-panel dark:bg-slate-900 sm:rounded-xl sm:border sm:border-slate-200 dark:sm:border-slate-700">
                    <div className="flex h-full min-h-0 min-w-0">
                        <aside className={`hidden shrink-0 flex-col border-r border-slate-200 bg-[#f8faff] py-5 text-[#263852] transition-[width,padding] duration-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 lg:flex ${chatNavCollapsed ? "w-[68px] px-2" : "w-[200px] px-3"}`}>
                            <div className={`mb-5 flex items-center gap-2 px-2 ${chatNavCollapsed ? "justify-center px-0" : ""}`}>
                                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#174a7e] text-white"><GraduationCap size={21} /></span>
                                {!chatNavCollapsed && <span className="min-w-0"><strong className="block truncate text-xs font-extrabold tracking-tight text-[#203754] dark:text-slate-100">Student Manager</strong></span>}
                            </div>
                            <div className={`mb-2 px-2 ${chatNavCollapsed ? "text-center" : ""}`}>{!chatNavCollapsed && <p className="text-[9px] font-bold tracking-[.14em] text-slate-500 dark:text-slate-400">{t("navigation")}</p>}</div>
                            <nav className="space-y-1">
                                <button type="button" title={t("overviewNav")} aria-label={t("overviewNav")} onClick={() => navigate('/students')} className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-[#64748b] transition hover:bg-[#e8f1fb] hover:text-[#174a7e] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${chatNavCollapsed ? "justify-center px-0" : ""}`}><Home size={17} />{!chatNavCollapsed && t("overviewNav")}</button>
                                <button type="button" title={`${t("chat")}${totalUnreadMessages ? ` — ${totalUnreadMessages} ${t("unread")}` : ""}`} aria-label={`${t("chat")}${totalUnreadMessages ? `, ${totalUnreadMessages} ${t("unread")}` : ""}`} aria-current="page" className={`relative flex h-10 w-full items-center gap-3 rounded-lg bg-[#e8f1fb] px-3 text-left text-xs font-semibold text-[#174a7e] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-[#174a7e] dark:bg-slate-800 dark:text-blue-300 dark:before:bg-blue-400 ${chatNavCollapsed ? "justify-center px-0" : ""}`}><MessageSquare size={17} />{!chatNavCollapsed && t("chat")}{totalUnreadMessages > 0 && <span className={`absolute rounded-full bg-rose-500 text-center text-[9px] font-bold leading-4 text-white ${chatNavCollapsed ? "right-0 top-0 min-w-4 px-1" : "right-2 min-w-5 px-1"}`}>{totalUnreadMessages > 99 ? "99+" : totalUnreadMessages}</span>}</button>
                            </nav>
                            <div className="mt-auto border-t border-[#e3eaf4] dark:border-slate-700 pt-3">
                                <div className={`flex min-w-0 items-center gap-2 px-2 pt-2 ${chatNavCollapsed ? "justify-center px-0" : ""}`} title={user?.username || t("user")}><AvatarFallback name={user?.username || t("user")} src={user?.avatar_url || user?.avatarUrl || user?.avatar} size="sm" />{!chatNavCollapsed && <span className="min-w-0"><strong className="block truncate text-[10px] text-slate-800 dark:text-slate-100">{user?.username || t("user")}</strong><small className="text-[9px] text-slate-400">{user?.role === "admin" ? t("administrator") : t("user")}</small></span>}</div>
                            </div>
                        </aside>
                        <ChatSidebar
                            mobileHidden={Boolean(activeId && activeConversation)}
                            conversations={conversations}
                            onlineUserIds={onlineUserIds}
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
                                e2eeStatus={e2eeStatus}
                                e2eeClientReady={e2eeClient.isLocalStoreReady && e2eeClient.relayState === 'connected'}
                                onEnableE2EE={enableActiveConversationE2EE}
                                enablingE2EE={enablingE2EE}
                                onBackToList={() => setActiveId(null)}
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
                        ) : activeId ? (
                            <div className="max-[767px]:hidden flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-[#f4f8fd] text-center dark:bg-slate-950" role="status" aria-live="polite">
                                <span className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"><MessageSquare size={23} /></span>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("openingConversation")}</p>
                                <span className="size-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" aria-hidden="true" />
                            </div>
                        ) : (
                            <div className="max-[767px]:hidden min-w-0 flex-1">
                                <EmptyChat
                                    onStartConversation={() => {
                                        const newChatButton = document.querySelector('[data-new-chat]');
                                        newChatButton?.click();
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
