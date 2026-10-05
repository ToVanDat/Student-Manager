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
        <div className="flex h-[calc(100vh-theme(spacing.16))] bg-slate-100 p-4 gap-0">
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
    );
}