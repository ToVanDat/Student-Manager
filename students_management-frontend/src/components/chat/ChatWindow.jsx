import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
    FolderOpen,
    Mic,
    Square
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { toast } from 'sonner';

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
    onPreviewFile,
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
    onRedial,
    onHideCall,
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
    onReportConversation,
    onSearchMessages,
    onOpenSearchResult
}) {
    const [input, setInput] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const messagesEndRef = useRef(null);
    const composerInputRef = useRef(null);
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
    const [showContactInfo, setShowContactInfo] = useState(false);
    const [showMediaPanel, setShowMediaPanel] = useState(false);
    const [reportReason, setReportReason] = useState('spam');
    const [showSearchPanel, setShowSearchPanel] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [messageSearchResults, setMessageSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const searchRequestIdRef = useRef(0);
    const searchPanelRef = useRef(null);
    const searchTriggerRef = useRef(null);
    const [searchPanelPosition, setSearchPanelPosition] = useState({ top: 0, left: 0, width: 360 });
    const [moreMenuPosition, setMoreMenuPosition] = useState({ top: 0, left: 0 });
    const emojiPickerRef = useRef(null);
    const moreMenuRef = useRef(null);
    const moreMenuPanelRef = useRef(null);
    const moreTriggerRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const [recordingVoice, setRecordingVoice] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const recordingSecondsRef = useRef(0);
    const recordingTimerRef = useRef(null);

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

    const directUserId = Number(activeConversation?.userId);
    const isDirectOnline = activeConversation?.type === 'direct'
        && Number.isInteger(directUserId)
        && onlineUserIds.has(directUserId);
    const presenceLabel = isDirectOnline
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
        const query = searchQuery.trim();
        if (!showSearchPanel || !query) {
            searchRequestIdRef.current += 1;
            setSearching(false);
            setSearchError('');
            if (!query) setMessageSearchResults([]);
            return undefined;
        }

        const requestId = ++searchRequestIdRef.current;
        setSearching(true);
        setMessageSearchResults([]);
        setSearchError('');
        const timer = setTimeout(async () => {
            try {
                if (typeof onSearchMessages !== 'function') {
                    throw new Error('Chưa kết nối chức năng tìm kiếm tin nhắn.');
                }
                const results = await onSearchMessages(query);
                if (requestId !== searchRequestIdRef.current) return;
                setMessageSearchResults(Array.isArray(results) ? results : []);
            } catch (error) {
                if (requestId !== searchRequestIdRef.current) return;
                console.error('Không thể tìm kiếm message:', error);
                setMessageSearchResults([]);
                setSearchError(error?.response?.data?.message || 'Không thể tìm kiếm tin nhắn. Vui lòng thử lại.');
            } finally {
                if (requestId === searchRequestIdRef.current) setSearching(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            if (requestId === searchRequestIdRef.current) searchRequestIdRef.current += 1;
        };
    }, [showSearchPanel, searchQuery, activeConversation?.id, onSearchMessages]);

    useEffect(() => {
        setShowMoreMenu(false);
        setShowSearchPanel(false);
        setSearchQuery('');
        setMessageSearchResults([]);
        setSearchError('');
        setSearching(false);
        setShowGroupInfo(false);
        setShowContactInfo(false);
        setShowMediaPanel(false);
        setShowReportDialog(false);
    }, [activeConversation?.id]);

    useEffect(() => {
        const handleClickOutsideMore = (event) => {
            if (
                moreMenuRef.current && !moreMenuRef.current.contains(event.target)
                && !moreMenuPanelRef.current?.contains(event.target)
            ) {
                setShowMoreMenu(false);
            }
        };
        const handleMoreKeyDown = event => {
            if (event.key === 'Escape') setShowMoreMenu(false);
        };
        if (showMoreMenu) {
            document.addEventListener('mousedown', handleClickOutsideMore);
            document.addEventListener('keydown', handleMoreKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutsideMore);
            document.removeEventListener('keydown', handleMoreKeyDown);
        };
    }, [showMoreMenu]);

    const positionSearchPanel = useCallback(() => {
        const rect = searchTriggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = Math.min(360, Math.max(window.innerWidth - 24, 0));
        const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
        const panelHeight = 390;
        const below = rect.bottom + 8;
        const top = below + panelHeight <= window.innerHeight - 12
            ? below
            : Math.max(12, rect.top - panelHeight - 8);
        setSearchPanelPosition({ top, left, width });
    }, []);

    const positionMoreMenu = useCallback(() => {
        const rect = moreTriggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = 256;
        const menuHeight = 390;
        const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
        const below = rect.bottom + 8;
        const top = below + menuHeight <= window.innerHeight - 12
            ? below
            : Math.max(12, rect.top - menuHeight - 8);
        setMoreMenuPosition({ top, left });
    }, []);

    useEffect(() => {
        if (!showSearchPanel && !showMoreMenu) return undefined;
        const updatePositions = () => {
            if (showSearchPanel) positionSearchPanel();
            if (showMoreMenu) positionMoreMenu();
        };
        window.addEventListener('resize', updatePositions);
        window.addEventListener('scroll', updatePositions, true);
        return () => {
            window.removeEventListener('resize', updatePositions);
            window.removeEventListener('scroll', updatePositions, true);
        };
    }, [showSearchPanel, showMoreMenu, positionSearchPanel, positionMoreMenu]);

    useEffect(() => {
        if (!showSearchPanel) return undefined;
        const handleSearchOutside = event => {
            if (searchPanelRef.current?.contains(event.target)) return;
            if (searchTriggerRef.current?.contains(event.target)) return;
            setShowSearchPanel(false);
        };
        const handleSearchKeyDown = event => {
            if (event.key === 'Escape') setShowSearchPanel(false);
        };
        document.addEventListener('mousedown', handleSearchOutside);
        document.addEventListener('keydown', handleSearchKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleSearchOutside);
            document.removeEventListener('keydown', handleSearchKeyDown);
        };
    }, [showSearchPanel]);

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

    const runMoreAction = async action => {
        setShowMoreMenu(false);
        try {
            await action();
            toast.success('Đã cập nhật cuộc trò chuyện.');
        } catch (error) {
            console.error('Không thể thực hiện thao tác cuộc trò chuyện:', error);
            toast.error(error?.response?.data?.message || error?.message || 'Thao tác thất bại. Vui lòng thử lại.');
        }
    };

    const updateConversationSetting = async (action, value) => {
        if (typeof onUpdateConversationSettings !== 'function') {
            throw new Error('Chức năng cài đặt cuộc trò chuyện chưa được kết nối.');
        }
        const result = await onUpdateConversationSettings(action, value);
        if (result == null) throw new Error('Không tìm thấy cuộc trò chuyện đang mở.');
        return result;
    };

    const blockConversationUser = async () => {
        if (typeof onBlockUser !== 'function') {
            throw new Error('Chức năng chặn người dùng chưa được kết nối.');
        }
        return onBlockUser(activeConversation.userId);
    };

    const submitConversationReport = async () => {
        if (typeof onReportConversation !== 'function') {
            toast.error('Chức năng báo cáo chưa được kết nối.');
            return;
        }
        try {
            await onReportConversation(activeConversation.userId, reportReason);
            setShowReportDialog(false);
            toast.success('Đã gửi báo cáo.');
        } catch (error) {
            console.error('Không thể gửi báo cáo:', error);
            toast.error(error?.response?.data?.message || error?.message || 'Không thể gửi báo cáo. Vui lòng thử lại.');
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

    const stopVoiceRecording = async (cancel = false) => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;

        if (cancel) {
            recorder.ondataavailable = null;
            recorder.onstop = null;
            if (recorder.state !== 'inactive') recorder.stop();
            recorder.stream?.getTracks().forEach(track => track.stop());
            mediaRecorderRef.current = null;
            recordedChunksRef.current = [];
            setRecordingVoice(false);
            setRecordingSeconds(0);
            recordingSecondsRef.current = 0;
            clearInterval(recordingTimerRef.current);
            return;
        }

        if (recorder.state !== 'inactive') recorder.stop();
    };

    const startVoiceRecording = async () => {
        if (recordingVoice || isUploading || !onSendAttachment) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';
            const recorder = new MediaRecorder(stream, { mimeType });

            recordedChunksRef.current = [];
            mediaRecorderRef.current = recorder;
            setRecordingVoice(true);
            setRecordingSeconds(0);
            recordingSecondsRef.current = 0;

            recorder.ondataavailable = event => {
                if (event.data.size > 0) recordedChunksRef.current.push(event.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                mediaRecorderRef.current = null;
                clearInterval(recordingTimerRef.current);
                setRecordingVoice(false);

                const chunks = recordedChunksRef.current;
                recordedChunksRef.current = [];
                const seconds = recordingSecondsRef.current;

                if (!chunks.length || seconds < 1) {
                    setRecordingSeconds(0);
                    return;
                }

                const blob = new Blob(chunks, { type: mimeType });
                const file = new File(
                    [blob],
                    `voice-${Date.now()}.webm`,
                    { type: 'audio/webm' }
                );

                try {
                    setIsUploading(true);
                    await onSendAttachment(file);
                } catch (error) {
                    console.error('Lỗi gửi voice message:', error);
                } finally {
                    setIsUploading(false);
                    setRecordingSeconds(0);
                    recordingSecondsRef.current = 0;
                }
            };

            recorder.start();

            recordingTimerRef.current = setInterval(() => {
                setRecordingSeconds(value => {
                    if (value >= 59) {
                        stopVoiceRecording();
                        return value;
                    }
                    const next = value + 1;
                    recordingSecondsRef.current = next;
                    return next;
                });
            }, 1000);
        } catch (error) {
            console.error('Không thể ghi âm:', error);
        }
    };

    useEffect(() => () => {
        clearInterval(recordingTimerRef.current);
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        recorder?.stream?.getTracks().forEach(track => track.stop());
    }, []);

    return (
        <section className="relative flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-900">

            {/* ================= HEADER ================= */}

            <header className="h-[76px] px-5 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">

                <div className="flex items-center gap-3">

                    <AvatarFallback
                        name={activeConversation.name}
                        src={activeConversation.avatar}
                        size="lg"
                        showStatus
                        isOnline={isDirectOnline}
                    />

                    <div>
                        <h3 className="text-[16px] font-bold text-slate-900 dark:text-slate-100">
                            {activeConversation.name}
                        </h3>

                        <p
                            className={`text-[12px] mt-0.5 ${
                                activeConversation.type === 'group'
                                    ? 'text-slate-400'
                                    : isDirectOnline
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
                        ref={searchTriggerRef}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => {
                            if (!showSearchPanel) positionSearchPanel();
                            setShowSearchPanel(prev => !prev);
                        }}
                        aria-label="Tìm kiếm tin nhắn"
                        aria-expanded={showSearchPanel}
                        aria-controls="chat-message-search"
                        title="Tìm kiếm tin nhắn"
                    >
                        <Search size={18} />
                    </button>

                    {activeConversation.type !== 'group' && (
                        <>
                            <button
                                type="button"
                                onClick={() => onStartCall?.(activeConversation.userId, 'voice', {
                                    name: activeConversation.name,
                                    avatar: activeConversation.avatar
                                })}
                                disabled={callState !== 'idle'}
                                className="h-9 w-9 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800"
                                title="Gọi thoại"
                            >
                                <Phone size={18} />
                            </button>

                            <button
                                type="button"
                                onClick={() => onStartCall?.(activeConversation.userId, 'video', {
                                    name: activeConversation.name,
                                    avatar: activeConversation.avatar
                                })}
                                disabled={callState !== 'idle'}
                                className="h-9 w-9 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800"
                                title="Gọi video"
                            >
                                <Video size={18} />
                            </button>
                        </>
                    )}

                    <div className="relative" ref={moreMenuRef}>
                        <button
                            type="button"
                            ref={moreTriggerRef}
                            onClick={() => {
                                if (activeConversation.type === 'group') {
                                    setShowGroupInfo(true);
                                    return;
                                }
                                if (!showMoreMenu) positionMoreMenu();
                                setShowMoreMenu(prev => !prev);
                            }}
                            aria-label={activeConversation.type === 'group' ? 'Thông tin nhóm' : 'Thêm tùy chọn cuộc trò chuyện'}
                            aria-haspopup={activeConversation.type === 'group' ? 'dialog' : 'menu'}
                            aria-expanded={activeConversation.type === 'group' ? showGroupInfo : showMoreMenu}
                            className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={activeConversation.type === 'group' ? 'Thông tin nhóm' : 'Tuỳ chọn'}
                        >
                            <MoreVertical size={18} />
                        </button>

                        {showMoreMenu && activeConversation.type !== 'group' && createPortal(
                            <div
                                ref={moreMenuPanelRef}
                                role="menu"
                                style={{ position: 'fixed', top: moreMenuPosition.top, left: moreMenuPosition.left, maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}
                                className="z-[1000] w-64 overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                            >
                                <button type="button" role="menuitem" onClick={() => { setShowContactInfo(true); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <UserRound size={16} /> Xem thông tin
                                </button>
                                <button type="button" role="menuitem" onClick={() => { setShowMediaPanel(true); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <FolderOpen size={16} /> File & Media
                                </button>
                                <button type="button" role="menuitem" onClick={() => runMoreAction(() => updateConversationSetting('pin', !activeConversation.isPinned))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <Pin size={16} /> {activeConversation.isPinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện'}
                                </button>
                                <button type="button" role="menuitem" onClick={() => { const until = activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? null : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); void runMoreAction(() => updateConversationSetting('mute', until)); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                                    {activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? <Bell size={16} /> : <BellOff size={16} />}
                                    {activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? 'Bật lại thông báo' : 'Tắt thông báo 8 giờ'}
                                </button>
                                <button type="button" role="menuitem" onClick={() => runMoreAction(() => updateConversationSetting('unread', true))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <MailOpen size={16} /> Đánh dấu chưa đọc
                                </button>
                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                <button type="button" role="menuitem" onClick={() => { if (window.confirm('Ẩn cuộc trò chuyện này khỏi danh sách?')) void runMoreAction(() => updateConversationSetting('hide', true)); else setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                    <Trash2 size={16} /> Xóa cuộc trò chuyện
                                </button>
                                <button type="button" role="menuitem" onClick={() => { if (window.confirm('Chặn người dùng này? Bạn sẽ không thể tiếp tục nhắn tin/gọi cho họ.')) void runMoreAction(blockConversationUser); else setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                    <Ban size={16} /> Chặn người dùng
                                </button>
                                <button type="button" role="menuitem" onClick={() => { setShowReportDialog(true); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                    <Flag size={16} /> Báo cáo
                                </button>
                            </div>,
                            document.body
                        )}
                    </div>
                </div>

            </header>

            {showSearchPanel && createPortal(
                <div
                    ref={searchPanelRef}
                    id="chat-message-search"
                    role="search"
                    style={{ position: 'fixed', top: searchPanelPosition.top, left: searchPanelPosition.left, width: searchPanelPosition.width }}
                    className="z-[1000] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                >
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 dark:bg-slate-800">
                        <Search size={16} className="text-slate-400" />
                        <input
                            autoFocus
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            aria-label="Tìm trong tin nhắn của cuộc trò chuyện"
                            placeholder="Tìm tin nhắn trong cuộc trò chuyện..."
                            className="h-10 flex-1 bg-transparent text-sm outline-none dark:text-slate-100"
                        />
                        <button
                            type="button"
                            aria-label="Xóa từ khóa tìm kiếm"
                            onClick={() => { setSearchQuery(''); setMessageSearchResults([]); setSearchError(''); }}
                            className="rounded-md p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                            <X size={15} className="text-slate-400" />
                        </button>
                    </div>
                    <div className="mt-2 max-h-72 overflow-y-auto">
                        {searching && <p className="px-2 py-4 text-center text-xs text-slate-400">Đang tìm...</p>}
                        {!searching && searchError && <p role="alert" className="px-2 py-4 text-center text-xs text-red-500">{searchError}</p>}
                        {!searching && !searchError && searchQuery.trim() && messageSearchResults.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-400">Không tìm thấy tin nhắn</p>}
                        {!searching && messageSearchResults.map(result => (
                            <button
                                type="button"
                                key={result.id}
                                onClick={() => {
                                    onOpenSearchResult?.(result);
                                    setShowSearchPanel(false);
                                }}
                                className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <div className="flex items-center gap-2">
                                    <AvatarFallback
                                        name={result.sender_username || activeConversation.name}
                                        src={result.sender_avatar || activeConversation.avatar}
                                        size="xs"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        {result.sender_username || activeConversation.name}
                                    </span>
                                    <span className="shrink-0 text-[10px] text-slate-400">
                                        {new Date(result.created_at).toLocaleString('vi-VN')}
                                    </span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-sm text-slate-700 dark:text-slate-200">
                                    {result.content}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}

            {showContactInfo && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-5 backdrop-blur-[2px]">
                    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">Thông tin người dùng</h4>
                            <button type="button" onClick={() => setShowContactInfo(false)}><X size={18}/></button>
                        </div>
                        <div className="mt-5 flex flex-col items-center text-center">
                            <AvatarFallback name={activeConversation.name} src={activeConversation.avatar} size="lg" />
                            <h3 className="mt-3 text-lg font-bold">{activeConversation.name}</h3>
                            <p className="mt-1 text-sm text-slate-500">{presenceLabel}</p>
                            {activeConversation.type === 'direct' && activeConversation.email && (
                                <p className="mt-1 max-w-full truncate text-sm text-slate-500 dark:text-slate-400">
                                    {activeConversation.email}
                                </p>
                            )}
                            {activeConversation.type === 'direct' && (
                                <p className="mt-1 text-xs text-slate-400">@{activeConversation.name}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showMediaPanel && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-5 backdrop-blur-[2px]">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">File & Media</h4>
                            <button type="button" onClick={() => setShowMediaPanel(false)}><X size={18}/></button>
                        </div>
                        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                            {messages.flatMap(message => (message.files || []).map(file => ({ file, message }))).length === 0 ? (
                                <p className="py-10 text-center text-sm text-slate-400">Chưa có file hoặc media nào.</p>
                            ) : (
                                messages.flatMap(message => (message.files || []).map(file => ({ file, message }))).map(({ file }) => (
                                    <button type="button" key={file.id} onClick={() => onDownloadFile?.(file)} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                                        <FolderOpen size={18} className="text-blue-500"/>
                                        <span className="min-w-0 flex-1 truncate text-sm">{file.file_name}</span>
                                        <span className="text-xs text-slate-400">Tải</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

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
                            <button type="button" onClick={submitConversationReport} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Gửi báo cáo</button>
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

                {messages.map((msg) => {
                    if (msg._timelineType === 'date') {
                        return (
                            <div key={msg.id} className="flex justify-center py-3">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                                    {msg.dateLabel}
                                </span>
                            </div>
                        );
                    }

                    return (
                    <MessageBubble
                        key={msg.id}
                        data-message-id={msg.id}
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
                            msg._timelineType === 'call'
                                ? Number(msg.caller_id) === Number(currentUserId)
                                : Number(
                                    msg.sender_id ??
                                    msg.senderId
                                ) === Number(currentUserId)
                        }
                        senderAvatar={activeConversation.avatar}
                        onRedial={onRedial}
                        senderName={activeConversation.name}
                         onHideCall={onHideCall}
                         onViewProfile={() => setShowContactInfo(true)}
                         onFocusComposer={() => composerInputRef.current?.focus()}
                        onEdit={onEdit}
                        onRecall={onRecall}
                        onDeleteForMe={onDeleteForMe}
                        onDeleteForEveryone={onDeleteForEveryone}
                        onDownloadFile={onDownloadFile}
                        onPreviewFile={onPreviewFile}
                        onDeleteFile={onDeleteFile}
                        onReply={(message) => setReplyTo(message)}
                        onToggleReaction={onToggleReaction}
                        currentUserId={currentUserId}
                    />
                    );
                })}

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

                <button
                    type="button"
                    title={recordingVoice ? 'Dừng ghi âm' : 'Ghi âm'}
                    disabled={isUploading}
                    onClick={() => recordingVoice ? stopVoiceRecording() : startVoiceRecording()}
                    className={`flex items-center gap-1 rounded-full p-2 ${recordingVoice ? 'bg-red-50 text-red-600 dark:bg-red-950/30' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800'} disabled:opacity-50`}
                >
                    {recordingVoice ? <Square size={18} /> : <Mic size={20} />}
                    {recordingVoice && <span className="text-[11px]">{recordingSeconds}s</span>}
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
                    ref={composerInputRef}
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
