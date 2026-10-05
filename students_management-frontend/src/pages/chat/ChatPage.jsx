
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
        isTyping 
    } = useChat();

    const activeConversation = conversations.find(c => c.id === activeId);

    return (
        <div className="flex h-[calc(100vh-theme(spacing.16))] bg-slate-100 p-4 gap-0">
            {/* Sidebar danh sách bên trái */}
            <ChatSidebar
                conversations={conversations}
                activeId={activeId}
                onSelectConversation={setActiveId}
            />

            {/* Khung chat bên phải (Nếu chọn hội thoại thì hiện ChatWindow, chưa chọn thì hiện EmptyChat) */}
            {activeId ? (
                <ChatWindow
                    activeConversation={activeConversation}
                    messages={messages}
                    currentUserId={user?.id}
                    onSendMessage={sendMessage}
                    isTyping={isTyping}
                />
            ) : (
                <EmptyChat />
            )}
        </div>
    );
}