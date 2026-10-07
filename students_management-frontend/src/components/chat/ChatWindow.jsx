import React, { useEffect, useRef, useState } from 'react';
import {
    MoreVertical,
    Search,
    Send,
    Paperclip,
    Smile,
    Reply
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

import MessageBubble from './MessageBubble';
import AvatarFallback from './AvatarFallback';

export default function ChatWindow({
    activeConversation,
    messages,
    currentUserId,
    onSendMessage,
    onSendAttachment,
    onDownloadFile,
    onDeleteFile,
    isTyping,
    onTyping,
    onEdit,
    onRecall,
    onDeleteForMe,
    onDeleteForEveryone,
    onReply,
    onToggleReaction,
    hasMoreMessages,
    loadingOlder,
    onLoadOlder
}) {
    const [input, setInput] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const messagesEndRef = useRef(null);
    const typingTimer = useRef(null);
    const fileInputRef = useRef(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const emojiPickerRef = useRef(null);

    const lastSeenLabel = activeConversation?.lastSeenAt
        ? new Date(activeConversation.lastSeenAt).toLocaleString([], {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        })
        : 'Chưa có dữ liệu;

    const [isDarkMode, setIsDarkMode] = useState(
        document.documentElement.classList.contains('dark')
    );

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth'
        });
    }, [messages, isTyping]);

    useEffect(() => {
        return () => clearTimeout(typingTimer.current);
    }, []);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDarkMode(
                document.documentElement.classList.contains('dark')
            );
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                emojiPickerRef.current &&
                !emojiPickerRef.current.contains(event.target)
            ) {
                setShowEmojiPicker(false);
            }
        };

        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

    const handleChange = (e) => {
        const value = e.target.value;

        setInput(value);
        onTyping?.(Boolean(value.trim()));

        clearTimeout(typingTimer.current);

        if (value.trim()) {
            typingTimer.current = setTimeout(() => {
                onTyping?.(false);
            }, 800);
        }
    };

    const handleSend = (e) => {
        e.preventDefault();

        if (!input.trim()) return;

        onSendMessage(input, replyTo?.id || null);

        setInput('');
        setReplyTo(null);
        onTyping?.(false);
    };

    const handleEmojiClick = (emojiData) => {
        setInput((prev) => prev + emojiData.emoji);
    };

    const handleAttachmentClick = () => {
        if (isUploading) return;
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];

        // Cho phép chọn lại đúng file sau khi upload xong.
        event.target.value = '';

        if (!file || !onSendAttachment) return;

        try {
            setIsUploading(true);
            await onSendAttachment(file);
        } catch (error) {
            console.error('Lỗi gửi file:', error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <section className="flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-900">

            {/* ================= HEADER ================= */}

            <header className="h-[84px] px-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">

                <div className="flex items-center gap-3">

                    <AvatarFallback
                        name={activeConversation.name}
                        src={activeConversation.avatar}
                        size="lg"
                        showStatus
                        isOnline={activeConversation.isOnline}
                    />

                    <div>
                        <h3 className="text-[16px] font-bold text-slate-900 dark:text-slate-100">
                            {activeConversation.name}
                        </h3>

                        <p
                            className={`text-[12px] mt-0.5 ${
                                activeConversation.type === 'group'
                                    ? 'text-slate-400'
                                    : activeConversation.isOnline
                                        ? 'text-emerald-500'
                                        : 'text-slate-400'
                            }`}
                        >
                            {activeConversation.type === 'group'
                                ? `${activeConversation.memberCount || 0} thành viên`
                                : activeConversation.isOnline
                                    ? 'Đang hoạt động'
                                    : 'Ngoại tuyến'}
                        </p>
                    </div>

                </div>

                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-300">

                    <button
                        type="button"
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                    >
                        <Search size={18} />
                    </button>

                    <button
                        type="button"
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                    >
                        <MoreVertical size={18} />
                    </button>

                </div>

            </header>

            {/* ================= MESSAGES ================= */}

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-6 bg-white dark:bg-slate-900">
                {hasMoreMessages && (
                    <div className="flex justify-center mb-4">
                        <button
                            type="button"
                            onClick={onLoadOlder}
                            disabled={loadingOlder}
                            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                            {loadingOlder ? 'Đang tải...' : 'Tải tin nhắn cũ hơn'}
                        </button>
                    </div>
                )}

                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        message={{
                            ...msg,
                            senderId: Number(
                                msg.sender_id ?? msg.senderId
                            ),
                            isRead:
                                msg.is_read ??
                                msg.isRead,
                            time: new Date(
                                msg.created_at ??
                                msg.createdAt
                            ).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                        }}
                        isOwn={
                            Number(
                                msg.sender_id ??
                                msg.senderId
                            ) === Number(currentUserId)
                        }
                        senderAvatar={activeConversation.avatar}
                        senderName={activeConversation.name}
                        onEdit={onEdit}
                        onRecall={onRecall}
                        onDeleteForMe={onDeleteForMe}
                        onDeleteForEveryone={onDeleteForEveryone}
                        onDownloadFile={onDownloadFile}
                        onDeleteFile={onDeleteFile}
                        onReply={onReply ? (message) => { setReplyTo(message); onReply(message); } : undefined}
                        onToggleReaction={onToggleReaction}
                        currentUserId={currentUserId}
                    />
                ))}

                {isTyping && (
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-3 ml-1">
                        {activeConversation.name} đang nhập...
                    </div>
                )}

                <div ref={messagesEndRef} />

            </div>

            {/* ================= INPUT AREA ================= */}

            {replyTo && (
                <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-2 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-3">
                    <Reply size={16} className="text-blue-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-slate-400">Đang trả lời</p>
                        <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                            {replyTo.content || 'Tin nhắn có tệp'}
                        </p>
                    </div>
                    <button type="button" onClick={() => setReplyTo(null)} className="text-xs text-slate-500 hover:text-slate-800">Huỷ</button>
                </div>
            )}

            <form
                onSubmit={handleSend}
                className="min-h-[78px] px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900"
            >

                {/* ================= ATTACHMENT ================= */}

                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                />

                <button
                    type="button"
                    title="Đính kèm tệp"
                    disabled={isUploading}
                    className="p-2 text-slate-500 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full disabled:opacity-50"
                    onClick={handleAttachmentClick}
                >
                    <Paperclip size={20} />
                </button>

                {/* ================= EMOJI ================= */}

                <div
                    ref={emojiPickerRef}
                    className="relative"
                >

                    <button
                        type="button"
                        title="Emoji"
                        onClick={() =>
                            setShowEmojiPicker(
                                (prev) => !prev
                            )
                        }
                        className="p-2 text-slate-500 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full"
                    >
                        <Smile size={20} />
                    </button>

                    {showEmojiPicker && (
                        <div className="absolute bottom-14 left-0 z-50">
                            <EmojiPicker
                                onEmojiClick={handleEmojiClick}
                                theme={
                                    isDarkMode
                                        ? 'dark'
                                        : 'light'
                                }
                                width={350}
                                height={400}
                                lazyLoadEmojis
                                searchDisabled={false}
                                previewConfig={{
                                    showPreview: false
                                }}
                            />
                        </div>
                    )}

                </div>

                {/* ================= TEXT INPUT ================= */}

                <input
                    type="text"
                    placeholder="Nhập tin nhắn..."
                    value={input}
                    onChange={handleChange}
                    className="flex-1 h-12 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-full px-5 text-sm focus:outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-950"
                />

                {/* ================= SEND ================= */}

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
