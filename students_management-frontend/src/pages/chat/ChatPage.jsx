import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ChatSidebar from '@/components/chat/ChatSidebar.jsx';
import ChatWindow from '@/components/chat/ChatWindow.jsx';
import EmptyChat from '@/components/chat/EmptyChat.jsx';
import StudentHeader from '@/components/layout/StudentHeader.jsx';
import StudentSidebar from '@/components/layout/StudentSidebar.jsx';
import useWebRTCCall from '@/hooks/useWebRTCCall.js';
import CallCenterPanel from '@/components/call/CallCenterPanel.jsx';

import { useChat } from '@/hooks/useChat.js';
import { useAuth } from '@/hooks/useAuth.js';

export default function ChatPage() {
    const navigate = useNavigate();
    const { user, logoutUser, webRTCCall } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [headerSearch, setHeaderSearch] = useState('');
    const [callCenterOpen, setCallCenterOpen] = useState(false);

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

    const unreadCount = conversations.reduce(
        (total, conversation) => total + Number(conversation.unreadCount || 0),
        0
    );

    const handleNavigate = (page) => {
        setSidebarOpen(false);

        if (page === 'chat') return;

        if (page === 'dashboard' || page === 'students') {
            navigate('/students');
            return;
        }

        if (page === 'settings') {
            navigate('/students');
        }
    };

    return (
        <div className={darkMode ? 'dark' : ''}>
            <div className="flex min-h-screen bg-[#f5f7fb] font-sans text-[#17233c] dark:bg-slate-950 dark:text-slate-100">
                <StudentSidebar
                    user={user}
                    activePage="chat"
                    totalStudents={11}
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onNavigate={handleNavigate}
                    onOpenSettings={() => navigate('/students')}
                    unreadCount={unreadCount}
                />

                <main className="ml-[250px] min-h-screen min-w-0 flex-1 max-[1100px]:ml-[220px] max-[800px]:ml-0">
                    <StudentHeader
                        user={user}
                        search={headerSearch}
                        onSearchChange={setHeaderSearch}
                        darkMode={darkMode}
                        onToggleDarkMode={() => setDarkMode(current => !current)}
                        onOpenSettings={() => navigate('/students')}
                        onLogout={logoutUser}
                        onToggleSidebar={() => setSidebarOpen(open => !open)}
                        unreadCount={unreadCount}
                        onOpenNotifications={() => setSidebarOpen(false)}
                    />

                    <CallCenterPanel
                        open={callCenterOpen}
                        onClose={() => setCallCenterOpen(false)}
                        currentUserId={Number(user?.id)}
                    />

                    <section className="h-[calc(100vh-76px)] min-h-0 p-5 lg:p-6">
                        <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-[#e7ebf3] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex h-full min-h-0">
                                <ChatSidebar
                                    conversations={conversations}
                                    onlineUserIds={onlineUserIds}
                                    onOpenCallCenter={() => setCallCenterOpen(true)}
                                    activeId={activeId}
                                    onSelectConversation={setActiveId}
                                    searchUsers={searchUsers}
                                    searchResults={searchResults}
                                    onStartConversation={startConversation}
                                    onStartGroupConversation={startGroupConversation}
                                />

                                {activeId && activeConversation ? (
                                    <>
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

                                    </>
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
                    </section>
                </main>
            </div>
        </div>
    );
}
