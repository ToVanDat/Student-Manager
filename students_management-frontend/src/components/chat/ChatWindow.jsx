import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical, Search, Send } from 'lucide-react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({
    activeConversation,
    messages,
    currentUserId,
    onSendMessage,
    isTyping,
    onTyping
}) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);
    const typingTimer = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    useEffect(() => () => clearTimeout(typingTimer.current), []);

    const handleChange = e => {
        const value = e.target.value;
        setInput(value);
        onTyping?.(Boolean(value.trim()));

        clearTimeout(typingTimer.current);
        if (value.trim()) {
            typingTimer.current = setTimeout(() => onTyping?.(false), 800);
        }
    };

    const handleSend = e => {
        e.preventDefault();
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
        onTyping?.(false);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white rounded-r-2xl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img
                        src={activeConversation.avatar || 'https://via.placeholder.com/40'}
                        alt={activeConversation.name}
                        className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">{activeConversation.name}</h3>
                        <p className="text-xs text-slate-400">Cuộc trò chuyện 1-1</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                    <button className="p-2 hover:bg-slate-50 rounded-full"><Search size={18} /></button>
                    <button className="p-2 hover:bg-slate-50 rounded-full"><MoreVertical size={18} /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {messages.map(msg => (
                    <MessageBubble
                        key={msg.id}
                        message={{
                            ...msg,
                            senderId: Number(msg.sender_id ?? msg.senderId),
                            isRead: msg.is_read ?? msg.isRead,
                            time: new Date(msg.created_at ?? msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                        }}
                        isOwn={Number(msg.sender_id ?? msg.senderId) === Number(currentUserId)}
                        senderAvatar={activeConversation.avatar}
                    />
                ))}

                {isTyping && (
                    <div className="text-xs text-slate-400 mb-3">
                        {activeConversation.name} đang nhập...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 border-t border-slate-100 flex items-center gap-2">
                <input
                    type="text"
                    placeholder="Nhập tin nhắn..."
                    value={input}
                    onChange={handleChange}
                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={!input.trim()}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl"
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}