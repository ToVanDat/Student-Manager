import React, { useEffect, useRef, useState } from 'react';
import {
    MoreVertical,
    Search,
    Phone,
    Video,
    Send,
    Paperclip,
    Smile,
    Reply,
    X,
    Pin,
    BellOff,
    Bell,
    MailOpen,
    Trash2,
    Ban,
    Flag,
    UserRound,
    FolderOpen
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

import MessageBubble from './MessageBubble';
import AvatarFallback from './AvatarFallback';
import GroupInfoPanel from './GroupInfoPanel';

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
    onToggleReaction,
    hasMoreMessages,
    loadingOlder,
    onLoadOlder,
    conversationMembers = [],
    searchUsers,
    searchResults = [],
    onAddGroupMember,
    onRemoveGroupMember,
    onUpdateGroupMemberRole,
    onUpdateGroupConversation,
    onLeaveGroup,
    onlineUserIds = new Set(),
    callState = 'idle',
    call = null,
    onStartCall,
    onUpdateConversationSettings,
    onBlockUser,
    onUnblockUser,
    onReportConversation
}) {
    const [input, setInput] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const previousMessageCountRef = useRef(0);
    const previousScrollHeightRef = useRef(0);
    const shouldRestoreScrollRef = useRef(false);
    const shouldScrollToBottomRef = useRef(true);
    const previousLastMessageIdRef = useRef(null);
    const [newMessageCount, setNewMessageCount] = useState(0);
    const typingTimer = useRef(null);
    const fileInputRef = useRef(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showReportDialog, setShowReportDialog] = useState(false);
    const [reportReason, setReportReason] = useState('spam');
    const emojiPickerRef = useRef(null);
    const moreMenuRef = useRef(null);

    const formatLastSeen = (value) => {
        if (!value) return 'Ngoại tuyến';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Ngoại tuyến';
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const diffMs = Math.max(now.getTime() - date.getTime(), 0);
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        if (date >= startOfToday) {
            if (diffMinutes < 1) return 'Hoạt động vừa xong';
            if (diffMinutes < 60) return 'Hoạt động ' + diffMinutes + ' phút trước';
            if (diffHours < 24) return 'Hoạt động ' + diffHours + ' giờ trước';
        }
        if (date >= startOfYesterday) return 'Hoạt động hôm qua';
        return 'Hoạt động ' + date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const presenceLabel = activeConversation?.isOnline
        ? 'Đang hoạt động'
        : formatLastSeen(activeConversation?.lastSeenAt);

    const [isDarkMode, setIsDarkMode] = useState(
        document.documentElement.classList.contains('dark')
    );

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        if (shouldRestoreScrollRef.current) {
            const previousHeight = previousScrollHeightRef.current;
            container.scrollTop += container.scrollHeight - previousHeight;
            shouldRestoreScrollRef.current = false;
            previousMessageCountRef.current = messages.length;
            return;
        }

        const lastMessage = messages[messages.length - 1];
        const lastId = lastMessage?.id ?? null;
        const isInitialLoad = previousMessageCountRef.current === 0;
        const lastMessageChanged = previousLastMessageIdRef.current !== lastId;

        if (isInitialLoad) {
            container.scrollTop = container.scrollHeight;
        } else if (lastMessageChanged) {
            if (shouldScrollToBottomRef.current) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                setNewMessageCount(0);
            } else {
                setNewMessageCount(count => count + 1);
            }
        }

        previousLastMessageIdRef.current = lastId;
        previousMessageCountRef.current = messages.length;
    }, [messages]);

    useEffect(() => {
        if (shouldScrollToBottomRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isTyping]);

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
        const handleClickOutsideMore = (event) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
                setShowMoreMenu(false);
            }
        };
        if (showMoreMenu) document.addEventListener('mousedown', handleClickOutsideMore);
        return () => document.removeEventListener('mousedown', handleClickOutsideMore);
    }, [showMoreMenu]);

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
        <section className="relative flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-900">

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
                                ? activeConversation.memberCount + ' thành viên'
                                : presenceLabel}
                        </p>
                    </div>

                </div>

                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-300">
                    <button
                        type="button"
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Tìm kiếm tin nhắn"
                    >
                        <Search size={18} />
                    </button>

                    {activeConversation.type !== 'group' && (
                        <>
                            <button
                                type="button"
                                onClick={() => onStartCall?.(activeConversation.userId, 'voice')}
                                disabled={callState !== 'idle'}
                                className="p-2 rounded-full hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800"
                                title="Gọi thoại"
                            >
                                <Phone size={18} />
                            </button>

                            <button
                                type="button"
                                onClick={() => onStartCall?.(activeConversation.userId, 'video')}
                                disabled={callState !== 'idle'}
                                className="p-2 rounded-full hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800"
                                title="Gọi video"
                            >
                                <Video size={18} />
                            </button>
                        </>
                    )}

                    <div className="relative" ref={moreMenuRef}>
                        <button
                            type="button"
                            onClick={() => {
                                if (activeConversation.type === 'group') {
                                    setShowGroupInfo(true);
                                    return;
                                }
                                setShowMoreMenu(prev => !prev);
                            }}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={activeConversation.type === 'group' ? 'Thông tin nhóm' : 'Tuỳ chọn'}
                        >
                            <MoreVertical size={18} />
                        </button>

                        {showMoreMenu && activeConversation.type !== 'group' && (
                            <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                                <button type="button" onClick={() => setShowMoreMenu(false)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <UserRound size={16} /> Xem thông tin
                                </button>
                                <button type="button" onClick={() => setShowMoreMenu(false)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <FolderOpen size={16} /> File & Media
                                </button>
                                <button type="button" onClick={async () => { await onUpdateConversationSettings?.('pin', !activeConversation.isPinned); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <Pin size={16} /> {activeConversation.isPinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện'}
                                </button>
                                <button type="button" onClick={async () => { const until = activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? null : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); await onUpdateConversationSettings?.('mute', until); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                                    {activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? <Bell size={16} /> : <BellOff size={16} />}
                                    {activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? 'Bật lại thông báo' : 'Tắt thông báo 8 giờ'}
                                </button>
                                <button type="button" onClick={async () => { await onUpdateConversationSettings?.('unread', true); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <MailOpen size={16} /> Đánh dấu chưa đọc
                                </button>
                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                <button type="button" onClick={async () => { if (window.confirm('Ẩn cuộc trò chuyện này khỏi danh sách?')) { await onUpdateConversationSettings?.('hide', true); } setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                    <Trash2 size={16} /> Xóa cuộc trò chuyện
                                </button>
                                <button type="button" onClick={async () => { if (window.confirm('Chặn người dùng này? Bạn sẽ không thể tiếp tục nhắn tin/gọi cho họ.')) { await onBlockUser?.(activeConversation.userId); } setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                    <Ban size={16} /> Chặn người dùng
                                </button>
                                <button type="button" onClick={() => { setShowReportDialog(true); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                    <Flag size={16} /> Báo cáo
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </header>

            {showReportDialog && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-5 backdrop-blur-[2px]">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">Báo cáo người dùng</h4>
                            <button type="button" onClick={() => setShowReportDialog(false)}><X size={18} /></button>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Chọn lý do để gửi báo cáo.</p>
                        <select value={reportReason} onChange={e => setReportReason(e.target.value)} className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                            <option value="spam">Spam</option>
                            <option value="harassment">Quấy rối</option>
                            <option value="scam">Lừa đảo</option>
                            <option value="inappropriate">Nội dung không phù hợp</option>
                            <option value="other">Khác</option>
                        </select>
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowReportDialog(false)} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">Hủy</button>
                            <button type="button" onClick={async () => { await onReportConversation?.(activeConversation.userId, reportReason); setShowReportDialog(false); }} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Gửi báo cáo</button>
                        </div>
                    </div>
                </div>
            )}

            <GroupInfoPanel
                open={showGroupInfo}
                conversation={activeConversation}
                members={conversationMembers}
                currentUserId={currentUserId}
                searchUsers={searchUsers}
                searchResults={searchResults}
                onAddMember={onAddGroupMember}
                onRemoveMember={onRemoveGroupMember}
                onUpdateRole={onUpdateGroupMemberRole}
                onUpdateGroupConversation={onUpdateGroupConversation}
                onLeaveGroup={onLeaveGroup}
                onlineUserIds={onlineUserIds}
                onClose={() => setShowGroupInfo(false)}
            />

            {/* ================= MESSAGES ================= */}

            <div className="relative flex-1 min-h-0">
                {newMessageCount > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                            setNewMessageCount(0);
                            shouldScrollToBottomRef.current = true;
                        }}
                        className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-blue-700"
                    >
                        {newMessageCount} tin nhắn mới ↓
                    </button>
                )}

                <div
                ref={messagesContainerRef}
                onScroll={(event) => {
                    const container = event.currentTarget;
                    const distanceFromBottom =
                        container.scrollHeight -
                        container.scrollTop -
                        container.clientHeight;

                    // 120px là ngưỡng để coi user vẫn đang ở cuối.
                    const wasNearBottom = distanceFromBottom < 120;
                    shouldScrollToBottomRef.current = wasNearBottom;

                    if (wasNearBottom) setNewMessageCount(0);

                    if (
                        container.scrollTop < 80 &&
                        hasMoreMessages &&
                        !loadingOlder
                    ) {
                        previousScrollHeightRef.current = container.scrollHeight;
                        shouldRestoreScrollRef.current = true;
                        onLoadOlder?.();
                    }
                }}
                className="h-full overflow-y-auto px-5 py-6 bg-white dark:bg-slate-900">
                {hasMoreMessages && (
                    <div className="flex justify-center mb-4">
                        <button
                            type="button"
                            onClick={() => {
                                const container = messagesContainerRef.current;
                                if (!container) return;

                                previousScrollHeightRef.current = container.scrollHeight;
                                shouldRestoreScrollRef.current = true;
                                onLoadOlder?.();
                            }}
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
                        onReply={(message) => setReplyTo(message)}
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
            </div>

            {/* ================= INPUT AREA ================= */}

            {replyTo && (
                <div className="mx-5 mb-2 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 px-3 py-2.5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                        <Reply size={16} />
                    </div>

                    <div className="min-w-0 flex-1 border-l-2 border-blue-400 pl-3">
                        <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                            Đang trả lời
                        </p>
                        <p className="truncate text-xs leading-5 text-slate-600 dark:text-slate-300">
                            {replyTo.content || '📎 Tin nhắn có tệp đính kèm'}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        title="Hủy trả lời"
                        aria-label="Hủy trả lời"
                    >
                        <X size={16} />
                    </button>
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
