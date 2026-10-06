import React from 'react';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import EmptyChat from '@/components/chat/EmptyChat';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';

export default function ChatPage() {
    const { user } = useAuth();
    const {
        conversations,
        activeId,
        setActiveId,
        messages,
        sendMessage,
        isTyping,
        searchResults,
        searchUsers,
        startConversation,
        setTyping
    } = useChat();

    const activeConversation = conversations.find(c => Number(c.id) === Number(activeId));

    return (
        <div className="h-[calc(100vh-76px)] min-h-0 bg-[#f5f8fc] p-4 lg:p-5">
            <div className="h-full min-h-0 max-w-[1500px] mx-auto flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
                <ChatSidebar
                conversations={conversations}
                activeId={activeId}
                onSelectConversation={setActiveId}
                searchUsers={searchUsers}
                searchResults={searchResults}
                onStartConversation={startConversation}
            />
                {activeId && activeConversation ? (
                <ChatWindow
                    activeConversation={activeConversation}
                    messages={messages}
                    currentUserId={Number(user?.id)}
                    onSendMessage={sendMessage}
                    isTyping={isTyping}
                    onTyping={setTyping}
                />
                ) : (
                    <EmptyChat />
                )}
            </div>
        </div>
    );
}