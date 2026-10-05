import React, { useState, useRef, useEffect } from 'react';
import { Search, MoreVertical, Paperclip, Smile, Send } from 'lucide-react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ activeConversation, messages, currentUserId, onSendMessage, isTyping }) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    // Auto scroll bottom when new message arrives
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
    };

    if (!activeConversation) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50/50 rounded-r-2xl text-slate-400 text-sm">
                Chọn một cuộc trò chuyện để bắt đầu nhắn tin
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white rounded-r-2xl">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img
                            src={activeConversation.avatar || 'https://via.placeholder.com/40'}
                            alt={activeConversation.name}
                            className="w-10 h-10 rounded-full object-cover"
                        />
                        {activeConversation.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">{activeConversation.name}</h3>
                        <p className="text-xs text-emerald-600 font-medium">
                            {activeConversation.isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400">
                    <button className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                        <Search size={18} />
                    </button>
                    <button className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                        <MoreVertical size={18} />
                    </button>
                </div>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {/* Date separator */}
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
                        senderAvatar={activeConversation.avatar}
                    />
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                    <div className="flex items-center gap-2 mb-4">
                        <img src={activeConversation.avatar} className="w-7 h-7 rounded-full object-cover" alt="avatar" />
                        <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                            <span className="text-xs text-slate-400 ml-2 font-medium">{activeConversation.name} đang nhập...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-4 border-t border-slate-100 flex items-center gap-2">
                <button type="button" className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <Paperclip size={20} />
                </button>
                <button type="button" className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <Smile size={20} />
                </button>
                <input
                    type="text"
                    placeholder="Nhập tin nhắn..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
                <button
                    type="submit"
                    disabled={!input.trim()}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-md shadow-blue-500/20"
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}