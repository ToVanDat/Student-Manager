import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical, Search, Send, Paperclip, Smile } from 'lucide-react';
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
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [avatarError, setAvatarError] = useState(false);

    const emojis = ['😀', '😂', '😊', '😍', '🥰', '😎', '👍', '👏', '❤️', '🔥', '🎉', '😢', '😮', '🙏'];

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
        <section className="flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-900">
            <header className="h-[84px] px-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    {activeConversation.avatar && !avatarError ? (
                        <img src={activeConversation.avatar} alt={activeConversation.name} onError={() => setAvatarError(true)} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-sm font-bold">
                            {(activeConversation.name || 'U').charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h3 className="text-[16px] font-bold text-slate-900 dark:text-slate-100">{activeConversation.name}</h3>
                        <p className={`text-[12px] mt-0.5 ${activeConversation.isOnline ? 'text-emerald-500' : 'text-slate-400'}`}>
                            <span className={activeConversation.isOnline ? 'text-emerald-500' : 'text-slate-400'}>
                                {activeConversation.isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
                            </span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-300">
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:bg-slate-800 rounded-full"><Search size={18} /></button>
                    <button className="p-2 hover:bg-slate-50 rounded-full"><MoreVertical size={18} /></button>
                </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-6 bg-white dark:bg-slate-900">
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
                            senderName={activeConversation.name}
                    />
                ))}

                {isTyping && (
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-3 ml-1">
                        {activeConversation.name} đang nhập...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="min-h-[78px] px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900">
                <button
                    type="button"
                    title="Đính kèm tệp"
                    className="p-2 text-slate-500 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full"
                    onClick={() => alert('Chức năng tải tệp cần backend storage để lưu URL file.')}
                >
                    <Paperclip size={20} />
                </button>

                <div className="relative">
                    <button
                        type="button"
                        title="Emoji"
                        onClick={() => setShowEmojiPicker(prev => !prev)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                    >
                        <Smile size={20} />
                    </button>

                    {showEmojiPicker && (
                        <div className="absolute bottom-12 left-0 z-30 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 grid grid-cols-7 gap-1">
                            {emojis.map(emoji => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                        setInput(prev => prev + emoji);
                                        setShowEmojiPicker(false);
                                    }}
                                    className="text-xl p-1.5 rounded-lg hover:bg-slate-100"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <input
                    type="text"
                    placeholder="Nhập tin nhắn..."
                    value={input}
                    onChange={handleChange}
                    className="flex-1 h-12 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-full px-5 text-sm focus:outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-950"
                />
                <button
                    type="submit"
                    disabled={!input.trim()}
                    className="w-12 h-12 flex items-center justify-center bg-[#4b63f5] hover:bg-[#3f56e8] disabled:opacity-50 text-white rounded-full shadow-sm"
                    title="Gửi tin nhắn"
                >
                    <Send size={18} />
                </button>
            </form>
        </section>
    );
}