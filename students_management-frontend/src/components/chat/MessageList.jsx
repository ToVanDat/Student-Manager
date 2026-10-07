import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';

export default function MessageList({ messages, currentUserId, activeConversation, isTyping }) {
    const messagesEndRef = useRef(null);

    // Tự động cuộn xuống cuối khi có tin nhắn mới hoặc đang gõ (scroll )
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    return (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {/* Phân cách ngày */}
            <div className="flex justify-center my-4">
                <span className="text-[11px] bg-slate-100 text-slate-500 font-medium px-3 py-1 rounded-full">
                    Hôm nay
                </span>
            </div>

            {messages.map((msg) => (
                <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.senderId === currentUserId}
                    senderAvatar={activeConversation?.avatar}
                />
            ))}

            {/* Hiệu ứng Đang nhập... */}
            {isTyping && (
                <div className="flex items-center gap-2 mb-4">
                    <img src={activeConversation?.avatar} className="w-7 h-7 rounded-full object-cover" alt="avatar" />
                    <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        <span className="text-xs text-slate-400 ml-2 font-medium">{activeConversation?.name} đang nhập...</span>
                    </div>
                </div>
            )}
            
            <div ref={messagesEndRef} />
        </div>
    );
}