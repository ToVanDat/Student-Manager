import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ChatSidebar from '@/components/chat/ChatSidebar.jsx';
import ChatWindow from '@/components/chat/ChatWindow.jsx';
import EmptyChat from '@/components/chat/EmptyChat.jsx';
import StudentHeader from '@/components/layout/StudentHeader.jsx';
import StudentSidebar from '@/components/layout/StudentSidebar.jsx';

import { useChat } from '@/hooks/useChat.js';
import { useAuth } from '@/hooks/useAuth.js';

export default function ChatPage() {
    const navigate = useNavigate();
    const { user, logoutUser } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [headerSearch, setHeaderSearch] = useState('');

    const {
        conversations,
        activeId,
        setActiveId,
        messages,
        conversationMembers,
        sendMessage,
        sendAttachment,
        downloadFile,
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
        toggleReaction
    } = useChat();

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

                    <section className="h-[calc(100vh-76px)] min-h-0 p-5 lg:p-6">
                        <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-[#e7ebf3] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex h-full min-h-0">
                                <ChatSidebar
                                    conversations={conversations}
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
                                        messages={messages}
                                        currentUserId={Number(user?.id)}
                                        onSendMessage={sendMessage}
                                        onSendAttachment={sendAttachment}
                                        onDownloadFile={downloadFile}
                                        isTyping={isTyping}
                                        onTyping={setTyping}
                                        onEdit={editMessage}
                                        onRecall={recallMessage}
                                        onDeleteForMe={deleteMessageForMe}
                                        onDeleteForEveryone={deleteMessageForEveryone}
                                        onReply={() => {}}
                                        onToggleReaction={toggleReaction}
                                        conversationMembers={conversationMembers}
                                        searchUsers={searchUsers}
                                        searchResults={searchResults}
                                        onAddGroupMember={addGroupMember}
                                        onRemoveGroupMember={removeGroupMember}
                                        onUpdateGroupMemberRole={updateGroupMemberRole}
                onUpdateGroupConversation={updateGroupConversation}
                                        onLeaveGroup={leaveGroup}
                                        hasMoreMessages={hasMoreMessages}
                                        loadingOlder={loadingOlder}
                                        onLoadOlder={loadOlderMessages}
                                    />
                                ) : (
                                    <EmptyChat />
                                )}
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
