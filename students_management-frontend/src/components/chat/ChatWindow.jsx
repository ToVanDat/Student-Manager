import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    MoreVertical,
    Palette,
    ArrowLeft,
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
    Square,
    Image as ImageIcon,
    FileVideo2,
    Check,
    FileImage,
    PanelRight,
    Mail,
    Download,
    FileText,
    Shield,
    ShieldAlert,
    ShieldCheck,
    LoaderCircle
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { toast } from 'sonner';

import MessageBubble, { MessageMediaPreview } from './MessageBubble';
import E2EEIdentityVerification from './E2EEIdentityVerification';
import AvatarFallback from './AvatarFallback';
import GroupInfoPanel from './GroupInfoPanel';
import { notificationApi } from '@/api/notificationApi';
import { getConversationChatTheme, updateConversationChatTheme } from '@/api/chatApi.js';
import { useTheme } from '@/context/ThemeContext.jsx';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function ChatWindow({
    activeConversation,
    e2eeStatus = null,
    e2eeHistoryIssue = null,
    e2eeClientReady = false,
    onEnableE2EE,
    onPauseE2EE,
    enablingE2EE = false,
    onBackToList,
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
    onClearConversationMessages,
    onBlockUser,
    onUnblockUser,
    onReportConversation,
    onSearchMessages,
    onOpenSearchResult
}) {
    const { t, language } = useLanguage();
    const { isDarkMode } = useTheme();
    const activeConversationAvatar = activeConversation?.avatar_url || activeConversation?.avatarUrl || activeConversation?.avatar || activeConversation?.conversationAvatar || null;
    const [input, setInput] = useState('');
    const [showE2EEIdentityVerification, setShowE2EEIdentityVerification] = useState(false);
    const [chatTheme, setChatTheme] = useState('default');
    const [showChatThemePicker, setShowChatThemePicker] = useState(false);
    const [savingChatThemeIds, setSavingChatThemeIds] = useState(() => new Set());
    const activeConversationIdRef = useRef(activeConversation?.id);
    const chatThemeRequestVersionsRef = useRef(new Map());
    const pendingChatThemeIdsRef = useRef(new Set());

    activeConversationIdRef.current = activeConversation?.id;
    const chatThemes = useMemo(() => [
        {
            value: 'default', label: t('chatThemeDefault'),
            color: '#f5f8ff', dark: '#0f172a',
            surface: '#ffffff', surfaceDark: '#111827',
            border: '#e2e8f0', borderDark: '#334155',
            ownBubble: '#d8eaff', ownBubbleDark: '#1e3a5f',
            ownText: '#172b4d', ownTextDark: '#eff6ff',
            otherBubble: '#ffffff', otherBubbleDark: '#1e293b',
            otherText: '#1e293b', otherTextDark: '#e2e8f0',
            ownQuote: '#bfdbfe', ownQuoteDark: '#27476b',
            quote: '#f8fafc', quoteDark: '#273449',
            meta: '#64748b', metaDark: '#cbd5e1',
            accent: '#2563eb', accentDark: '#93c5fd'
        },
        {
            value: 'ocean', label: t('chatThemeOcean'),
            color: '#e0f2fe', dark: '#082f49',
            surface: '#f0f9ff', surfaceDark: '#0c344b',
            border: '#bae6fd', borderDark: '#155e75',
            ownBubble: '#bae6fd', ownBubbleDark: '#075985',
            ownText: '#0c4a6e', ownTextDark: '#f0f9ff',
            otherBubble: '#f0f9ff', otherBubbleDark: '#164e63',
            otherText: '#164e63', otherTextDark: '#ecfeff',
            ownQuote: '#7dd3fc', ownQuoteDark: '#0e7490',
            quote: '#e0f2fe', quoteDark: '#164e63',
            meta: '#0369a1', metaDark: '#bae6fd',
            accent: '#0284c7', accentDark: '#7dd3fc'
        },
        {
            value: 'lavender', label: t('chatThemeLavender'),
            color: '#f3e8ff', dark: '#2e1065',
            surface: '#faf5ff', surfaceDark: '#3b1a63',
            border: '#e9d5ff', borderDark: '#6b21a8',
            ownBubble: '#e9d5ff', ownBubbleDark: '#6d28d9',
            ownText: '#3b0764', ownTextDark: '#faf5ff',
            otherBubble: '#faf5ff', otherBubbleDark: '#4c1d95',
            otherText: '#4c1d95', otherTextDark: '#f3e8ff',
            ownQuote: '#d8b4fe', ownQuoteDark: '#7e22ce',
            quote: '#f3e8ff', quoteDark: '#4c1d95',
            meta: '#7e22ce', metaDark: '#e9d5ff',
            accent: '#9333ea', accentDark: '#d8b4fe'
        },
        {
            value: 'mint', label: t('chatThemeMint'),
            color: '#dcfce7', dark: '#052e16',
            surface: '#f0fdf4', surfaceDark: '#064e3b',
            border: '#bbf7d0', borderDark: '#166534',
            ownBubble: '#bbf7d0', ownBubbleDark: '#047857',
            ownText: '#14532d', ownTextDark: '#ecfdf5',
            otherBubble: '#f0fdf4', otherBubbleDark: '#065f46',
            otherText: '#166534', otherTextDark: '#d1fae5',
            ownQuote: '#86efac', ownQuoteDark: '#047857',
            quote: '#dcfce7', quoteDark: '#065f46',
            meta: '#15803d', metaDark: '#bbf7d0',
            accent: '#16a34a', accentDark: '#86efac'
        },
        {
            value: 'rose', label: t('chatThemeRose'),
            color: '#ffe4e6', dark: '#4c0519',
            surface: '#fff1f2', surfaceDark: '#500724',
            border: '#fecdd3', borderDark: '#9f1239',
            ownBubble: '#fecdd3', ownBubbleDark: '#9f1239',
            ownText: '#881337', ownTextDark: '#fff1f2',
            otherBubble: '#fff1f2', otherBubbleDark: '#701a35',
            otherText: '#9f1239', otherTextDark: '#ffe4e6',
            ownQuote: '#fda4af', ownQuoteDark: '#be123c',
            quote: '#ffe4e6', quoteDark: '#701a35',
            meta: '#be123c', metaDark: '#fecdd3',
            accent: '#e11d48', accentDark: '#fda4af'
        },
        {
            value: 'amber', label: t('chatThemeAmber'),
            color: '#fef3c7', dark: '#451a03',
            surface: '#fffbeb', surfaceDark: '#451a03',
            border: '#fde68a', borderDark: '#92400e',
            ownBubble: '#fde68a', ownBubbleDark: '#92400e',
            ownText: '#78350f', ownTextDark: '#fffbeb',
            otherBubble: '#fffbeb', otherBubbleDark: '#5a2e0b',
            otherText: '#92400e', otherTextDark: '#fef3c7',
            ownQuote: '#fcd34d', ownQuoteDark: '#a16207',
            quote: '#fef3c7', quoteDark: '#5a2e0b',
            meta: '#92400e', metaDark: '#fde68a',
            accent: '#d97706', accentDark: '#fcd34d'
        },
    ], [t]);
    const [conversationNotificationsEnabled, setConversationNotificationsEnabled] = useState(true);
    const [savingConversationNotifications, setSavingConversationNotifications] = useState(false);
    const [replyTo, setReplyTo] = useState(null);

    useEffect(() => {
        let active = true;
        setShowChatThemePicker(false);
        if (!activeConversation?.id) {
            setChatTheme('default');
            return () => { active = false; };
        }
        const conversationId = activeConversation.id;
        const conversationKey = String(conversationId);
        const requestVersion = chatThemeRequestVersionsRef.current.get(conversationKey) || 0;
        const storageKey = `chat-theme:${currentUserId}:${conversationId}`;
        const cached = (() => {
            try { return localStorage.getItem(storageKey); } catch { return null; }
        })();
        const cachedTheme = chatThemes.some(item => item.value === cached) ? cached : 'default';
        setChatTheme(cachedTheme);
        if (!pendingChatThemeIdsRef.current.has(conversationKey)) {
            getConversationChatTheme(conversationId)
                .then(({ data }) => {
                    const savedTheme = data?.data?.theme;
                    const latestVersion = chatThemeRequestVersionsRef.current.get(conversationKey) || 0;
                    if (active && requestVersion === latestVersion && !pendingChatThemeIdsRef.current.has(conversationKey) && chatThemes.some(item => item.value === savedTheme)) {
                    setChatTheme(savedTheme);
                    try { localStorage.setItem(storageKey, savedTheme); } catch { /* optional cache */ }
                    }
                })
                .catch((error) => {
                    // Keep the cached appearance, but surface schema setup errors so
                    // a missing database migration is not mistaken for a UI bug.
                    console.warn('[CHAT THEME] Could not load saved theme:', error?.response?.data?.message || error?.message);
                    if (active && error?.response?.status === 503) {
                        toast.error(error.response.data?.message || t('chatThemeLoadFailed'));
                    }
                });
        }
        return () => { active = false; };
    }, [activeConversation?.id, currentUserId, chatThemes]);

    const chooseChatTheme = async (nextTheme) => {
        if (!activeConversation?.id || !chatThemes.some(item => item.value === nextTheme)) return;
        const conversationId = activeConversation.id;
        const conversationKey = String(conversationId);
        if (pendingChatThemeIdsRef.current.has(conversationKey)) return;
        const previousTheme = chatTheme;
        const storageKey = `chat-theme:${currentUserId}:${conversationId}`;
        const requestVersion = (chatThemeRequestVersionsRef.current.get(conversationKey) || 0) + 1;
        chatThemeRequestVersionsRef.current.set(conversationKey, requestVersion);
        pendingChatThemeIdsRef.current.add(conversationKey);
        setChatTheme(nextTheme);
        setShowChatThemePicker(false);
        setSavingChatThemeIds(previous => new Set(previous).add(conversationKey));
        try { localStorage.setItem(storageKey, nextTheme); } catch { /* optional cache */ }
        try {
            await updateConversationChatTheme(conversationId, nextTheme);
        } catch (error) {
            toast.error(error.response?.data?.message || t('chatThemeSaveFailed'));
            // Roll back only if this request is still the newest choice for this conversation.
            const latestVersion = chatThemeRequestVersionsRef.current.get(conversationKey) || 0;
            if (latestVersion === requestVersion) {
                try { localStorage.setItem(storageKey, previousTheme); } catch { /* optional cache */ }
                if (String(activeConversationIdRef.current) === String(conversationId)) {
                    setChatTheme(previousTheme);
                }
            }
        } finally {
            pendingChatThemeIdsRef.current.delete(conversationKey);
            setSavingChatThemeIds(previous => {
                const next = new Set(previous);
                next.delete(conversationKey);
                return next;
            });
        }
    };
    useEffect(() => {
        let active = true;
        if (!activeConversation?.id) {
            setConversationNotificationsEnabled(true);
            return () => { active = false; };
        }
        notificationApi.getConversationPreference(activeConversation.id)
            .then(({ data }) => {
                if (active) setConversationNotificationsEnabled(data?.data?.notifications_enabled !== false);
            })
            .catch(error => {
                console.error('Không tải được cài đặt thông báo cuộc trò chuyện:', error);
            });
        return () => { active = false; };
    }, [activeConversation?.id]);

    const toggleConversationNotifications = async () => {
        if (!activeConversation?.id || savingConversationNotifications) return;
        const next = !conversationNotificationsEnabled;
        setSavingConversationNotifications(true);
        try {
            await notificationApi.updateConversationPreference(activeConversation.id, next);
            setConversationNotificationsEnabled(next);
            toast.success(next ? t('conversationNotificationsOn') : t('conversationNotificationsOff'));
        } catch (error) {
            toast.error(error.response?.data?.message || t('conversationNotificationsUpdateFailed'));
        } finally {
            setSavingConversationNotifications(false);
        }
    };

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
    const [mediaPanelFilter, setMediaPanelFilter] = useState('all');
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
    const [pendingAttachment, setPendingAttachment] = useState(null);
    const [pendingAttachmentQueue, setPendingAttachmentQueue] = useState([]);
    const [attachmentProgress, setAttachmentProgress] = useState(0);
    const [attachmentQuality, setAttachmentQuality] = useState('standard');
    const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState('');
    const [queuedPreviewUrls, setQueuedPreviewUrls] = useState({});

    useEffect(() => {
        const files = pendingAttachmentQueue.filter(file => file && (file.type.startsWith('image/') || file.type.startsWith('video/')));
        const urls = files.map(file => [file, URL.createObjectURL(file)]);
        setQueuedPreviewUrls(Object.fromEntries(urls.map(([file, url]) => [`${file.name}:${file.lastModified}:${file.size}`, url])));
        return () => urls.forEach(([, url]) => URL.revokeObjectURL(url));
    }, [pendingAttachmentQueue]);
    const [showDetailsPanel, setShowDetailsPanel] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1280);

    useEffect(() => {
        if (!pendingAttachment) {
            setAttachmentPreviewUrl('');
            return undefined;
        }
        const objectUrl = URL.createObjectURL(pendingAttachment);
        setAttachmentPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [pendingAttachment]);

    const formatLastSeen = (value) => {
        if (!value) return t('offlineStatus');
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
            if (diffMinutes < 1) return t('activeJustNow');
            if (diffMinutes < 60) return t('activeMinutesAgo').replace('{{count}}', String(diffMinutes));
            if (diffHours < 24) return t('activeHoursAgo').replace('{{count}}', String(diffHours));
        }
        if (date >= startOfYesterday) return t('activeYesterday');
        return 'Hoạt động ' + date.toLocaleDateString(language === 'en' ? 'en-US' : 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const directUserId = Number(activeConversation?.userId);
    const isDirectOnline = activeConversation?.type === 'direct'
        && Number.isInteger(directUserId)
        && onlineUserIds.has(directUserId);
    const presenceLabel = isDirectOnline
        ? t('activeNow')
        : formatLastSeen(activeConversation?.lastSeenAt);
    const sharedFiles = (messages || []).flatMap(message => (message.files || []).map(file => ({ ...file, messageId: message.id })));
    const filteredSharedFiles = sharedFiles.filter(file => {
        const mimeType = String(file.mime_type || '');
        if (mediaPanelFilter === 'image') return mimeType.startsWith('image/');
        if (mediaPanelFilter === 'video') return mimeType.startsWith('video/');
        if (mediaPanelFilter === 'file') return !mimeType.startsWith('image/') && !mimeType.startsWith('video/');
        return true;
    });

    const selectedChatTheme = chatThemes.find(item => item.value === chatTheme) || chatThemes[0];
    const chatBackground = isDarkMode ? selectedChatTheme.dark : selectedChatTheme.color;
    const chatThemeStyles = {
        backgroundColor: chatBackground,
        '--chat-theme-bg': chatBackground,
        '--chat-theme-surface': isDarkMode ? selectedChatTheme.surfaceDark : selectedChatTheme.surface,
        '--chat-theme-border': isDarkMode ? selectedChatTheme.borderDark : selectedChatTheme.border,
        '--chat-theme-own-bubble': isDarkMode ? selectedChatTheme.ownBubbleDark : selectedChatTheme.ownBubble,
        '--chat-theme-own-text': isDarkMode ? selectedChatTheme.ownTextDark : selectedChatTheme.ownText,
        '--chat-theme-other-bubble': isDarkMode ? selectedChatTheme.otherBubbleDark : selectedChatTheme.otherBubble,
        '--chat-theme-other-text': isDarkMode ? selectedChatTheme.otherTextDark : selectedChatTheme.otherText,
        '--chat-theme-own-quote': isDarkMode ? selectedChatTheme.ownQuoteDark : selectedChatTheme.ownQuote,
        '--chat-theme-quote': isDarkMode ? selectedChatTheme.quoteDark : selectedChatTheme.quote,
        '--chat-theme-meta': isDarkMode ? selectedChatTheme.metaDark : selectedChatTheme.meta,
        '--chat-theme-accent': isDarkMode ? selectedChatTheme.accentDark : selectedChatTheme.accent
    };

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
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (!files.length || !onSendAttachment) return;

        const mediaFiles = files.filter(file =>
            file.type.startsWith('image/') || file.type.startsWith('video/')
        );
        const otherFiles = files.filter(file =>
            !file.type.startsWith('image/') && !file.type.startsWith('video/')
        );

        if (mediaFiles.length) {
            const [first, ...rest] = mediaFiles;
            setPendingAttachment(first);
            setPendingAttachmentQueue(rest);
            setAttachmentProgress(0);
            setAttachmentQuality(first.type.startsWith('video/') ? '720p' : 'standard');
        }

        if (otherFiles.length) {
            setIsUploading(true);
            setAttachmentProgress(0);
            try {
                for (let index = 0; index < otherFiles.length; index += 1) {
                    await onSendAttachment(otherFiles[index], 'standard', (eventOrPercent) => {
                        const raw = typeof eventOrPercent === 'number'
                            ? eventOrPercent
                            : eventOrPercent?.total
                                ? (eventOrPercent.loaded / eventOrPercent.total) * 100
                                : null;
                        if (raw != null && Number.isFinite(raw)) {
                            const base = (index / otherFiles.length) * 100;
                            const current = (Math.max(0, Math.min(100, raw)) / otherFiles.length);
                            setAttachmentProgress(Math.min(99, Math.round(base + current)));
                        }
                    });
                    setAttachmentProgress(Math.round(((index + 1) / otherFiles.length) * 100));
                }
            } catch (error) {
                console.error('Lỗi gửi file:', error);
                toast.error(error?.response?.data?.message || 'Không gửi được tệp. Vui lòng thử lại.');
            } finally {
                setIsUploading(false);
                setAttachmentProgress(0);
            }
        }
    };

    const prepareImageForUpload = async (file, quality) => {
        if (!file.type.startsWith('image/') || quality === 'original' || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
        if (typeof createImageBitmap !== 'function') return file;

        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
            const maxEdge = quality === 'hd' ? 2560 : 1920;
            const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext('2d');
            if (!context) return file;
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality === 'hd' ? 0.88 : 0.76));
            if (!blob || blob.size >= file.size) return file;
            const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
            return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
        } catch (error) {
            console.warn('Không thể tối ưu ảnh trên trình duyệt, sẽ gửi file gốc:', error);
            return file;
        } finally {
            bitmap?.close?.();
        }
    };

    const confirmAttachmentSend = async () => {
        if (!pendingAttachment || isUploading) return;
        const file = pendingAttachment;
        const quality = attachmentQuality;
        setIsUploading(true);
        setAttachmentProgress(0);
        try {
            const uploadFile = await prepareImageForUpload(file, quality);
            // The parent upload handler may report real byte progress as its third argument.
            // Keep a fallback completion state for existing handlers that return no progress.
            let receivedProgress = false;
            const reportProgress = (eventOrPercent) => {
                const raw = typeof eventOrPercent === 'number'
                    ? eventOrPercent
                    : eventOrPercent?.total
                        ? (eventOrPercent.loaded / eventOrPercent.total) * 100
                        : null;
                if (raw == null || !Number.isFinite(raw)) return;
                receivedProgress = true;
                setAttachmentProgress(Math.max(0, Math.min(99, Math.round(raw))));
            };
            await onSendAttachment(uploadFile, quality, reportProgress);
            setAttachmentProgress(100);
            if (pendingAttachmentQueue.length) {
                const [nextFile, ...rest] = pendingAttachmentQueue;
                setPendingAttachment(nextFile);
                setPendingAttachmentQueue(rest);
                setAttachmentQuality(nextFile.type.startsWith('video/') ? '720p' : 'standard');
                setAttachmentProgress(0);
            } else {
                setPendingAttachment(null);
                setPendingAttachmentQueue([]);
            }
        } catch (error) {
            console.error('Lỗi gửi media:', error);
            toast.error(error?.response?.data?.message || 'Không gửi được media. Vui lòng thử lại.');
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
    <section data-chat-theme={chatTheme} className="relative flex min-w-0 flex-1 bg-[#f4f8fd] dark:bg-slate-950" style={chatThemeStyles}>
        <div className="relative flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-900" style={{ backgroundColor: 'var(--chat-theme-surface)' }}>

            {pendingAttachment && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6">
                    <div className="chat-media-composer flex max-h-[94vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4 sm:px-7">
                            <div className="flex items-center gap-3">
                                <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                                    {pendingAttachment.type.startsWith('video/') ? <FileVideo2 size={22} /> : <ImageIcon size={22} />}
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                                        Gửi {pendingAttachment.type.startsWith('video/') ? 'video' : 'ảnh'} – Chọn chất lượng
                                    </h2>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Chọn từng tệp trong lưới để xem trước, điều chỉnh chất lượng rồi gửi lần lượt.</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => { if (!isUploading) { setPendingAttachment(null); setPendingAttachmentQueue([]); setAttachmentProgress(0); } }} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100" aria-label="Đóng xem trước"><X size={20} /></button>
                        </div>

                        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 sm:p-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)]">
                            <div className="min-w-0">
                                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white">1</span>
                                    Xem trước · {pendingAttachmentQueue.length + 1} tệp đã chọn
                                </div>
                                <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4" data-media-grid>
                                    {[pendingAttachment, ...pendingAttachmentQueue].map((file, index) => (
                                        <div key={`${file.name}-tile-${file.lastModified}-${index}`} className="relative min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (index === 0) return;
                                                const queue = [...pendingAttachmentQueue];
                                                const selected = queue[index - 1];
                                                queue[index - 1] = pendingAttachment;
                                                setPendingAttachment(selected);
                                                setPendingAttachmentQueue(queue);
                                                setAttachmentQuality(selected.type.startsWith('video/') ? '720p' : 'standard');
                                            }}
                                            className={`group relative aspect-square overflow-hidden rounded-xl border-2 bg-slate-100 text-left ${index === 0 ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}
                                            aria-label={`Xem trước ${file.name}`} aria-pressed={index === 0} data-media-tile
                                        >
                                            {file.type.startsWith('image/') ? <img src={index === 0 ? attachmentPreviewUrl : queuedPreviewUrls[`${file.name}:${file.lastModified}:${file.size}`]} alt="" className="h-full w-full object-cover" /> : file.type.startsWith('video/') ? <video src={index === 0 ? attachmentPreviewUrl : queuedPreviewUrls[`${file.name}:${file.lastModified}:${file.size}`]} muted preload="metadata" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><FileImage size={24} className="text-blue-600" /></div>}
                                            {file.type.startsWith('video/') && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">VIDEO</span>}
                                            {index === 0 && <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-blue-600 text-white"><Check size={12} /></span>}
                                            <span className="absolute inset-x-0 bottom-0 truncate bg-slate-950/65 px-1.5 py-1 text-[9px] text-white">{file.name}</span>
                                        </button>
                                        {index > 0 && <button type="button" onClick={(event) => { event.stopPropagation(); setPendingAttachmentQueue(current => current.filter((_, queueIndex) => queueIndex !== index - 1)); }} disabled={isUploading} aria-label={`移除 ${file.name}`} title="移除文件" className="absolute -right-1.5 -top-1.5 z-10 flex size-6 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><X size={13} /></button>}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500 dark:text-slate-400 transition hover:border-blue-400 hover:text-blue-600" aria-label="Thêm ảnh hoặc video"><span className="text-2xl">+</span></button>
                                </div>
                                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                    {attachmentPreviewUrl && (pendingAttachment.type.startsWith('video/') ? (
                                        <video src={attachmentPreviewUrl} controls className="max-h-[320px] w-full bg-black object-contain" />
                                    ) : (
                                        <img src={attachmentPreviewUrl} alt="Xem trước tệp sẽ gửi" className="max-h-[320px] w-full object-contain" />
                                    ))}
                                    <div className="flex min-w-0 items-center gap-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                            {pendingAttachment.type.startsWith('video/') ? <FileVideo2 size={18} /> : <FileImage size={18} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{pendingAttachment.name}</p>
                                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{(pendingAttachment.size / (1024 * 1024)).toFixed(2)} MB · {pendingAttachment.type || 'Media'}</p><p className="mt-1 text-[10px] text-slate-400">Tệp đang chọn: {pendingAttachmentQueue.length + 1} trong {pendingAttachmentQueue.length + 1} tệp còn trong hàng đợi.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-0">
                                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white">2</span>
                                    Chọn chất lượng
                                </div>
                                <div className="space-y-2">
                                    {(pendingAttachment.type.startsWith('video/') ? [
                                        { value: '480p', title: 'Tiết kiệm dung lượng · 480p', body: 'Phù hợp khi mạng yếu hoặc muốn gửi nhanh.', ratio: 0.3 },
                                        { value: '720p', title: 'Tiêu chuẩn · 720p', body: 'Cân bằng giữa độ rõ và dung lượng.', ratio: 0.55 },
                                        { value: '1080p', title: 'Chất lượng cao · 1080p', body: 'Giữ hình ảnh rõ hơn, tệp sẽ lớn hơn.', ratio: 0.78 },
                                        { value: 'original', title: 'Video gốc', body: 'Gửi nguyên tệp, không chuyển mã.', ratio: 1 }
                                    ] : [
                                        { value: 'standard', title: 'Tiêu chuẩn', body: 'Tự tối ưu kích thước và dung lượng.', ratio: 0.55 },
                                        { value: 'hd', title: 'HD · Chất lượng cao', body: 'Giữ độ phân giải cao, ưu tiên độ rõ.', ratio: 0.82 },
                                        { value: 'original', title: 'Ảnh gốc', body: 'Gửi nguyên tệp, không nén ảnh.', ratio: 1 }
                                    ]).map(option => (
                                        <button
                                            type="button"
                                            key={option.value}
                                            aria-pressed={attachmentQuality === option.value}
                                            onClick={() => setAttachmentQuality(option.value)}
                                            className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition ${attachmentQuality === option.value ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}
                                        >
                                            <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${attachmentQuality === option.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>
                                                {attachmentQuality === option.value && <Check size={12} strokeWidth={3} />}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex flex-wrap items-center justify-between gap-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                    <span>{option.title}</span>
                                                    <span className="text-[10px] font-medium text-slate-400">≈ {(pendingAttachment.size * option.ratio / (1024 * 1024)).toFixed(1)} MB</span>
                                                </span>
                                                <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">{option.body}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                                    Dung lượng hiển thị là ước tính. Chất lượng ảnh/video được xử lý trên server khi gửi; nếu bộ mã hóa không khả dụng, server sẽ giữ tệp gốc.
                                </p>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 sm:px-7">
                            {isUploading && <div className="mb-3" role="status" aria-live="polite"><div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>Đang tải lên…</span><span>{attachmentProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${attachmentProgress}%` }} /></div></div>}
                            {pendingAttachmentQueue.length > 0 && <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Các tệp tiếp theo trong hàng đợi">{pendingAttachmentQueue.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex w-28 shrink-0 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-[10px]">{file.type.startsWith('video/') ? <FileVideo2 size={16} className="shrink-0 text-blue-600" /> : <FileImage size={16} className="shrink-0 text-blue-600" />}<span className="truncate">{file.name}</span></div>)}</div>}
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                            <button type="button" disabled={isUploading} onClick={() => { setPendingAttachment(null); setPendingAttachmentQueue([]); fileInputRef.current?.click(); }} className="rounded-xl px-5 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-100">Chọn tệp khác</button>
                            <button type="button" onClick={confirmAttachmentSend} disabled={isUploading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
                                {isUploading ? 'Đang gửi…' : `Gửi ${pendingAttachment.type.startsWith('video/') ? 'video' : 'ảnh'}`}
                            </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= HEADER ================= */}

            <header className="h-[76px] px-3 sm:px-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur" style={{ backgroundColor: 'var(--chat-theme-surface)', borderColor: 'var(--chat-theme-border)' }}>

                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <button type="button" onClick={onBackToList} title="Quay lại danh sách hội thoại" aria-label="Quay lại danh sách hội thoại" className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden">
                        <ArrowLeft size={19} />
                    </button>

                    <AvatarFallback
                        name={activeConversation.name}
                        src={activeConversationAvatar}
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

                <div className="flex shrink-0 items-center gap-1 text-slate-500 dark:text-slate-400">
                    {activeConversation.type === 'direct' && e2eeStatus?.available && (
                        e2eeStatus.enabled && e2eeStatus.mode !== 'paused' ? (
                            <>
                                <span className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" title="Tin nhắn mới được mã hóa đầu cuối">
                                    <ShieldCheck size={16} /> E2EE
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowE2EEIdentityVerification(true)}
                                    className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800"
                                    title="So sánh mã an toàn với người nhận"
                                >
                                    <ShieldCheck size={15} /> Xác minh
                                </button>
                                {showE2EEIdentityVerification && (
                                    <E2EEIdentityVerification
                                        currentUserId={currentUserId}
                                        recipientUserId={directUserId}
                                        recipientName={activeConversation?.name || activeConversation?.username || activeConversation?.fullName}
                                        onClose={() => setShowE2EEIdentityVerification(false)}
                                    />
                                )}
                                <button
                                type="button"
                                onClick={onPauseE2EE}
                                disabled={enablingE2EE || !onPauseE2EE}
                                className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                                title="Tạm dừng E2EE cho tin nhắn mới"
                            >
                                    Tạm dừng
                                </button>
                            </>
                        ) : e2eeStatus.enabled && e2eeStatus.mode === 'paused' ? (
                            <span
                                className="inline-flex h-9 items-center gap-1 rounded-xl bg-amber-50 px-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                title="E2EE đã tạm dừng. Tin nhắn mới không được mã hóa đầu cuối; lịch sử E2EE cũ được giữ nguyên."
                                role="status"
                            >
                                <Shield size={16} /> E2EE đã tạm dừng
                            </span>
                        ) : !e2eeStatus.activationEnabled ? (
                            <span
                                className="inline-flex h-9 items-center gap-1 rounded-xl bg-amber-50 px-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                title="Tạm dừng bật E2EE cho cuộc trò chuyện mới. Các cuộc trò chuyện E2EE đã bật vẫn giữ nguyên."
                                role="status"
                            >
                                <Shield size={16} /> E2EE tạm dừng
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={onEnableE2EE}
                                disabled={!e2eeStatus.canEnable || !e2eeClientReady || enablingE2EE}
                                className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-blue-300 dark:hover:bg-slate-800"
                                title={!e2eeStatus.canEnable ? 'Mỗi thành viên cần đăng ký khóa trên tất cả thiết bị đang hoạt động' : !e2eeClientReady ? 'Thiết bị hoặc relay chưa sẵn sàng' : 'Bật mã hóa đầu cuối'}
                            >
                                {enablingE2EE ? <LoaderCircle size={16} className="animate-spin" /> : <Shield size={16} />}
                                E2EE
                            </button>
                        )
                    )}
                    <div className="relative">
                        <button type="button" onClick={() => setShowChatThemePicker(open => !open)} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t('chatTheme')} title={t('chatTheme')} aria-expanded={showChatThemePicker}>
                            <Palette size={18} />
                        </button>
                        {showChatThemePicker && createPortal(
                            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget) setShowChatThemePicker(false); }}>
                                <section role="dialog" aria-modal="true" aria-label={t('chatTheme')} className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" style={{ maxHeight: 'min(620px, calc(100dvh - 32px))' }}>
                                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                                        <div className="min-w-0">
                                            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('chatTheme')}</h2>
                                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('chatThemeDescription')}</p>
                                        </div>
                                        <button type="button" onClick={() => setShowChatThemePicker(false)} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Đóng"><X size={18} /></button>
                                    </div>
                                    <div className="grid max-h-[min(440px,calc(100dvh-150px))] grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
                                        {chatThemes.map(item => (
                                            <button key={item.value} type="button" onClick={() => chooseChatTheme(item.value)} disabled={savingChatThemeIds.has(String(activeConversation?.id))} aria-pressed={chatTheme === item.value} className={`group flex min-h-[76px] items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${chatTheme === item.value ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'} disabled:cursor-wait disabled:opacity-60`}>
                                                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/10" style={{ backgroundColor: isDarkMode ? item.dark : item.color }}>
                                                    <span className="flex h-5 w-7 translate-x-1 items-center justify-center rounded-l-md text-[7px]" style={{ backgroundColor: isDarkMode ? item.ownBubbleDark : item.ownBubble, color: isDarkMode ? item.ownTextDark : item.ownText }}>Aa</span>
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{item.label}</span>
                                                    <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{chatTheme === item.value ? 'Đang sử dụng' : 'Áp dụng chủ đề'}</span>
                                                </span>
                                                {chatTheme === item.value && <Check size={17} className="shrink-0 text-blue-600 dark:text-blue-400" />}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                        <span>{savingChatThemeIds.has(String(activeConversation?.id)) ? 'Đang lưu chủ đề…' : 'Chủ đề áp dụng cho cuộc trò chuyện này'}</span>
                                        <button type="button" onClick={() => chooseChatTheme('default')} disabled={chatTheme === 'default' || savingChatThemeIds.has(String(activeConversation?.id))} className="rounded-lg px-3 py-2 font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-blue-300 dark:hover:bg-blue-950/40">Đặt lại</button>
                                    </div>
                                </section>
                            </div>,
                            document.body
                        )}
                    </div>
                    <button
                        type="button"
                        ref={searchTriggerRef}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => {
                            if (!showSearchPanel) positionSearchPanel();
                            setShowSearchPanel(prev => !prev);
                        }}
                        aria-label={t("conversationSearch")}
                        aria-expanded={showSearchPanel}
                        aria-controls="chat-message-search"
                        title={t("conversationSearch")}
                    >
                        <Search size={18} />
                    </button>

                    {activeConversation.type !== 'group' && (
                        <>
                            <button
                                type="button"
                                onClick={() => onStartCall?.(activeConversation.userId, 'voice', {
                                    name: activeConversation.name,
                                    avatar: activeConversationAvatar
                                })}
                                disabled={callState !== 'idle'}
                                className="h-9 w-9 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                                title={t("callVoice")}
                            >
                                <Phone size={18} />
                            </button>

                            <button
                                type="button"
                                onClick={() => onStartCall?.(activeConversation.userId, 'video', {
                                    name: activeConversation.name,
                                    avatar: activeConversationAvatar
                                })}
                                disabled={callState !== 'idle'}
                                className="h-9 w-9 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                                title={t("callVideo")}
                            >
                                <Video size={18} />
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowDetailsPanel(value => !value)}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${showDetailsPanel ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-100'}`}
                        aria-label={showDetailsPanel ? 'Ẩn thông tin cuộc trò chuyện' : 'Hiện thông tin cuộc trò chuyện'}
                        aria-expanded={showDetailsPanel}
                        title="Thông tin cuộc trò chuyện"
                    >
                        <PanelRight size={18} />
                    </button>

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
                                className="z-[1000] w-64 overflow-x-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-2xl"
                            >
                                <button type="button" role="menuitem" onClick={() => { setShowContactInfo(true); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <UserRound size={16} /> {t('conversationInfo')}
                                </button>
                                <button type="button" role="menuitem" onClick={() => { setShowMediaPanel(true); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <FolderOpen size={16} /> File & Media
                                </button>
                                <button type="button" role="menuitem" onClick={() => runMoreAction(() => updateConversationSetting('pin', !activeConversation.isPinned))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <Pin size={16} /> {activeConversation.isPinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện'}
                                </button>
                                <button type="button" role="menuitem" disabled={savingConversationNotifications} onClick={() => { void toggleConversationNotifications(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
                                    {conversationNotificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                                    {conversationNotificationsEnabled ? 'Tắt thông báo trên thiết bị' : 'Bật thông báo trên thiết bị'}
                                </button>
                                <button type="button" role="menuitem" onClick={() => { const until = activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? null : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); void runMoreAction(() => updateConversationSetting('mute', until)); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    {activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? <Bell size={16} /> : <BellOff size={16} />}
                                    {activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? 'Bật lại thông báo' : 'Tắt thông báo 8 giờ'}
                                </button>
                                <button type="button" role="menuitem" onClick={() => runMoreAction(() => updateConversationSetting('unread', true))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <MailOpen size={16} /> {t('markUnread')}
                                </button>
                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                <button type="button" role="menuitem" onClick={() => {
                                    if (window.confirm('Xóa toàn bộ tin nhắn và lịch sử cuộc gọi chỉ ở phía bạn? Người còn lại vẫn giữ lịch sử.')) {
                                        void runMoreAction(async () => {
                                            if (typeof onClearConversationMessages !== 'function') {
                                                throw new Error('Chức năng xóa nội dung cuộc trò chuyện chưa được kết nối.');
                                            }
                                            await onClearConversationMessages();
                                        });
                                    } else setShowMoreMenu(false);
                                }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50">
                                    <Trash2 size={16} /> Xóa nội dung cuộc trò chuyện
                                </button>
                                <button type="button" role="menuitem" onClick={() => {
                                    if (window.confirm('Ẩn cuộc trò chuyện này khỏi danh sách của bạn? Tin nhắn sẽ không bị xóa.')) {
                                        void runMoreAction(() => updateConversationSetting('hide', true));
                                    } else setShowMoreMenu(false);
                                }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <FolderOpen size={16} /> Ẩn cuộc trò chuyện
                                </button>
                                <button type="button" role="menuitem" onClick={() => { if (window.confirm('Chặn người dùng này? Bạn sẽ không thể tiếp tục nhắn tin/gọi cho họ.')) void runMoreAction(blockConversationUser); else setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50">
                                    <Ban size={16} /> {t('blockUser')}
                                </button>
                                <button type="button" role="menuitem" onClick={() => { setShowReportDialog(true); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50">
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
                    className="z-[1000] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-2xl"
                >
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800 px-3">
                        <Search size={16} className="text-slate-400" />
                        <input
                            autoFocus
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            aria-label="Tìm trong tin nhắn của cuộc trò chuyện"
                            placeholder="Tìm tin nhắn trong cuộc trò chuyện..."
                            className="h-10 flex-1 bg-transparent text-sm outline-none"
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
                        {searching && <p className="px-2 py-4 text-center text-xs text-slate-400">{t('searchingMessages')}</p>}
                        {!searching && searchError && <p role="alert" className="px-2 py-4 text-center text-xs text-red-500">{searchError}</p>}
                        {!searching && !searchError && searchQuery.trim() && messageSearchResults.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-400">{t('noMessagesFound')}</p>}
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
                                        src={result.sender_avatar || activeConversationAvatar}
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
                    <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">Thông tin người dùng</h4>
                            <button type="button" onClick={() => setShowContactInfo(false)}><X size={18}/></button>
                        </div>
                        <div className="mt-5 flex flex-col items-center text-center">
                            <AvatarFallback name={activeConversation.name} src={activeConversationAvatar} size="lg" />
                            <h3 className="mt-3 text-lg font-bold">{activeConversation.name}</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{presenceLabel}</p>
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
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">{t("mediaAndFiles")}</h4>
                            <button type="button" onClick={() => setShowMediaPanel(false)}><X size={18}/></button>
                        </div>
                        <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                            {[
                                ['all', t('allMedia')],
                                ['image', t('images')],
                                ['video', t('videos')],
                                ['file', t('documents')]
                            ].map(([key, label]) => <button key={key} type="button" onClick={() => setMediaPanelFilter(key)} className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition ${mediaPanelFilter === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>)}
                        </div>
                        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                            {filteredSharedFiles.length === 0 ? (
                                <p className="py-10 text-center text-sm text-slate-400">Chưa có file hoặc media nào.</p>
                            ) : (
                                filteredSharedFiles.map(file => {
                                    const image = String(file.mime_type || '').startsWith('image/');
                                    const video = String(file.mime_type || '').startsWith('video/');
                                    return <div key={file.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2">
                                        {image || video ? <MessageMediaPreview file={file} onPreviewFile={onPreviewFile} compact /> : <FolderOpen size={18} className="shrink-0 text-blue-500" />}
                                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-800 dark:text-slate-100">{file.file_name}</span><span className="mt-0.5 block text-[10px] text-slate-400">{Number(file.file_size) ? `${(Number(file.file_size) / (1024 * 1024)).toFixed(1)} MB` : file.mime_type || 'Tệp'}</span></span>
                                        {!image && !video && <button type="button" onClick={() => onDownloadFile?.(file)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Tải</button>}
                                    </div>;
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showReportDialog && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-5 backdrop-blur-[2px]">
                    <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">Báo cáo người dùng</h4>
                            <button type="button" onClick={() => setShowReportDialog(false)}><X size={18} /></button>
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Chọn lý do để gửi báo cáo.</p>
                        <select value={reportReason} onChange={e => setReportReason(e.target.value)} className="mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                            <option value="spam">Spam</option>
                            <option value="harassment">Quấy rối</option>
                            <option value="scam">Lừa đảo</option>
                            <option value="inappropriate">Nội dung không phù hợp</option>
                            <option value="other">Khác</option>
                        </select>
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowReportDialog(false)} className="rounded-xl px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100">Hủy</button>
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
                className="h-full overflow-y-auto px-5 py-6" style={{ backgroundColor: 'var(--chat-theme-bg)' }}>
                {e2eeHistoryIssue && (
                    <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                        <div className="flex items-start gap-2">
                            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold">Không thể mở lịch sử E2EE cục bộ</p>
                                <p className="mt-1 text-xs leading-5">Khóa lịch sử của trình duyệt này có thể đã mất hoặc dữ liệu không đọc được. Tin nhắn E2EE cũ không thể được khôi phục từ máy chủ. Đừng xóa dữ liệu trình duyệt, đặt lại kho khóa hoặc tạo identity mới để thử sửa lỗi; các thao tác đó có thể làm mất khả năng giải mã thêm dữ liệu.</p>
                            </div>
                        </div>
                    </div>
                )}
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
                            className="rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                            {loadingOlder ? 'Đang tải...' : 'Tải tin nhắn cũ hơn'}
                        </button>
                    </div>
                )}

                {messages.map((msg) => {
                    if (msg._timelineType === 'date') {
                        return (
                            <div key={msg.id} className="flex justify-center py-3">
                                <span className="rounded-full px-3 py-1 text-[11px] font-medium shadow-sm" style={{ backgroundColor: 'var(--chat-theme-surface)', color: 'var(--chat-theme-meta)', border: '1px solid var(--chat-theme-border)' }}>
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
                        senderAvatar={activeConversationAvatar}
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
                    <div role="status" aria-live="polite" className="mb-3 ml-1 flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border px-3.5 py-2.5 shadow-sm" style={{ backgroundColor: 'var(--chat-theme-other-bubble)', borderColor: 'var(--chat-theme-border)' }}>
                            <span className="sr-only">{activeConversation.name} đang nhập</span>
                            <span className="size-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.24s]" />
                            <span className="size-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.12s]" />
                            <span className="size-1.5 animate-bounce rounded-full bg-blue-600" />
                        </div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{activeConversation.name} đang nhập...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />

            </div>
            </div>

            {/* ================= INPUT AREA ================= */}

            {replyTo && (
                <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border px-3 py-2" style={{ backgroundColor: 'var(--chat-theme-surface)', borderColor: 'var(--chat-theme-border)' }}>
                    <div className="min-w-0 flex-1 border-l-[3px] border-blue-500 pl-2.5">
                        <p className="text-[11px] font-semibold leading-4 text-blue-700">Đang trả lời {replyTo.sender_name || replyTo.username || 'tin nhắn'}</p>
                        <p className="truncate text-xs leading-5 text-slate-600 dark:text-slate-300">
                            {replyTo.content || (replyTo.files?.length ? `📎 ${replyTo.files[0].file_name || 'Tệp đính kèm'}` : 'Tin nhắn đính kèm')}
                        </p>
                    </div>
                    <button type="button" onClick={() => setReplyTo(null)} className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 transition hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900" title="Hủy trả lời" aria-label="Hủy trả lời"><X size={15} /></button>
                </div>
            )}

            {isUploading && (
                <div className="border-t border-blue-100 bg-blue-50/70 px-4 py-2" role="status" aria-live="polite">
                    <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="inline-flex min-w-0 items-center gap-2 font-medium text-blue-700">
                            <span className="size-2 shrink-0 animate-pulse rounded-full bg-blue-600" />
                            Đang tải lên hoặc gửi tệp…
                        </span>
                        <span className="shrink-0 tabular-nums text-blue-600">{attachmentProgress}%</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-blue-100">
                        <div className="h-full rounded-full bg-blue-600 transition-all duration-200" style={{ width: `${attachmentProgress}%` }} />
                    </div>
                </div>
            )}

            <form
                onSubmit={handleSend}
                className="min-h-[78px] border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3 flex items-end gap-1.5 sm:px-5 sm:gap-2"
                style={{ backgroundColor: 'var(--chat-theme-surface)', borderColor: 'var(--chat-theme-border)' }}
            >

                {/* ================= ATTACHMENT ================= */}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.mp3,.wav,.ogg"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                />

                <button
                    type="button"
                    title="Đính kèm tệp"
                    disabled={isUploading}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-full disabled:opacity-50"
                    onClick={handleAttachmentClick}
                >
                    <Paperclip size={20} />
                </button>

                <button
                    type="button"
                    title={recordingVoice ? 'Dừng ghi âm' : 'Ghi âm'}
                    disabled={isUploading}
                    onClick={() => recordingVoice ? stopVoiceRecording() : startVoiceRecording()}
                    className={`flex items-center gap-1 rounded-full p-2 ${recordingVoice ? 'bg-red-50 text-red-600' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'} disabled:opacity-50`}
                >
                    {recordingVoice ? <Square size={18} /> : <Mic size={20} />}
                    {recordingVoice && <span className="text-[11px] font-medium">{recordingSeconds}s</span>}
                </button>

                {recordingVoice && (
                    <span role="status" aria-live="polite" className="hidden shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 sm:inline-flex">
                        <span className="size-2 animate-pulse rounded-full bg-red-500" />
                        Đang ghi âm
                    </span>
                )}

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
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-full"
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

                <textarea
                    ref={composerInputRef}
                    rows={1}
                    placeholder="Nhập tin nhắn..."
                    value={input}
                    onChange={event => {
                        handleChange(event);
                        event.currentTarget.style.height = 'auto';
                        event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 160)}px`;
                    }}
                    onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
                            event.preventDefault();
                            handleSend(event);
                        }
                    }}
                    onInput={event => {
                        event.currentTarget.style.height = 'auto';
                        event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 160)}px`;
                    }}
                    aria-label="Soạn tin nhắn"
                    className="max-h-40 min-h-12 flex-1 resize-none self-center rounded-2xl border px-4 py-3 text-sm leading-5 placeholder:text-slate-400 outline-none transition focus:ring-4 focus:ring-blue-50"
                    style={{ backgroundColor: 'var(--chat-theme-bg)', color: 'var(--chat-theme-other-text)', borderColor: 'var(--chat-theme-border)' }}
                />

                {/* ================= SEND ================= */}

                <button
                    type="submit"
                    disabled={!input.trim()}
                    className="flex size-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                    title={t("sendMessage")}
                >
                    <Send size={18} />
                </button>

            </form>
        </div>

        {showDetailsPanel && (
            <aside className="absolute inset-y-0 right-0 z-[80] flex w-[min(360px,88vw)] min-w-0 shrink-0 flex-col border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl xl:static xl:z-auto xl:w-[280px] xl:shadow-none 2xl:w-[300px]">
                <div className="flex h-[76px] items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5">
                    <div><h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t("information")}</h3><p className="mt-0.5 text-[11px] text-slate-400">{activeConversation.type === 'group' ? t('groupConversation') : t('contactProfile')}</p></div>
                    <button type="button" onClick={() => setShowDetailsPanel(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 xl:hidden" aria-label={t("closeInformationPanel")}><X size={18} /></button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="flex flex-col items-center border-b border-slate-100 dark:border-slate-800 px-5 py-6 text-center">
                        <AvatarFallback name={activeConversation.name} src={activeConversationAvatar} size="xl" showStatus={activeConversation.type !== 'group'} isOnline={isDirectOnline} />
                        <h4 className="mt-3 max-w-full truncate text-base font-bold text-slate-900 dark:text-slate-100">{activeConversation.name}</h4>
                        <p className={`mt-1 text-xs ${isDirectOnline ? 'text-emerald-600' : 'text-slate-500'}`}>{activeConversation.type === 'group' ? `${activeConversation.memberCount || conversationMembers.length} ${t('membersCount')}` : presenceLabel}</p>
                        <div className="mt-4 flex items-center gap-2">
                            {activeConversation.type !== 'group' && <>
                                <button type="button" disabled={callState !== 'idle'} onClick={() => onStartCall?.(activeConversation.userId, 'voice', { name: activeConversation.name, avatar: activeConversationAvatar })} className="flex size-10 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50" title={t("voiceCall")}><Phone size={17} /></button>
                                <button type="button" disabled={callState !== 'idle'} onClick={() => onStartCall?.(activeConversation.userId, 'video', { name: activeConversation.name, avatar: activeConversationAvatar })} className="flex size-10 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50" title={t("videoCall")}><Video size={17} /></button>
                            </>}
                            <button type="button" onClick={() => { positionSearchPanel(); setShowSearchPanel(true); }} className="flex size-10 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100" title="Tìm tin nhắn"><Search size={17} /></button>
                            {activeConversation.type === 'group' && <button type="button" onClick={() => setShowGroupInfo(true)} className="flex size-10 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100" title="Quản lý nhóm"><MoreVertical size={17} /></button>}
                        </div>
                    </div>

                    {activeConversation.type === 'direct' ? (
                        <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
                            <h5 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Thông tin cá nhân</h5>
                            <div className="space-y-3">
                                <div className="flex items-start gap-2.5 text-xs"><UserRound size={15} className="mt-0.5 shrink-0 text-slate-400" /><span className="min-w-0"><span className="block text-[10px] text-slate-400">Tài khoản</span><span className="break-all font-medium text-slate-700 dark:text-slate-200">{activeConversation.name || '—'}</span></span></div>
                                <div className="flex items-start gap-2.5 text-xs"><Mail size={15} className="mt-0.5 shrink-0 text-slate-400" /><span className="min-w-0"><span className="block text-[10px] text-slate-400">Email</span><span className="break-all font-medium text-slate-700 dark:text-slate-200">{activeConversation.email || 'Chưa cập nhật'}</span></span></div>
                            </div>
                        </div>
                    ) : (
                        <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
                            <div className="mb-3 flex items-center justify-between"><h5 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Thành viên</h5><span className="text-[10px] text-slate-400">{conversationMembers.length}</span></div>
                            <div className="space-y-3">
                                {conversationMembers.slice(0, 6).map(member => <div key={member.user_id} className="flex min-w-0 items-center gap-2.5"><AvatarFallback name={member.username || member.name} src={member.avatar_url || member.avatar} size="sm" showStatus isOnline={onlineUserIds.has(Number(member.user_id))} /><span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">{member.username || member.name || 'Thành viên'}</span>{member.role === 'owner' && <span className="text-[9px] font-semibold text-blue-600">Trưởng nhóm</span>}</div>)}
                                {conversationMembers.length === 0 && <p className="text-xs text-slate-400">Chưa tải được danh sách thành viên.</p>}
                                {conversationMembers.length > 6 && <button type="button" onClick={() => setShowGroupInfo(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Xem tất cả thành viên</button>}
                            </div>
                        </div>
                    )}

                    <div className="px-5 py-4">
                        <div className="mb-3 flex items-center justify-between"><h5 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tệp đã chia sẻ</h5><button type="button" onClick={() => setShowMediaPanel(true)} className="text-[10px] font-semibold text-blue-600 hover:text-blue-700">Xem tất cả</button></div>
                        {sharedFiles.length ? (
                            <div className="space-y-2">
                                {sharedFiles.slice(-6).reverse().map(file => {
                                    const image = String(file.mime_type || '').startsWith('image/');
                                    const video = String(file.mime_type || '').startsWith('video/');
                                    return <div key={file.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-2">
                                        {image || video ? <MessageMediaPreview file={file} onPreviewFile={onPreviewFile} compact /> : <button type="button" onClick={() => onDownloadFile?.(file)} className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"><FileText size={17} /></button>}
                                        <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{file.file_name || 'Tệp đính kèm'}</span><span className="mt-0.5 block text-[10px] text-slate-400">{Number(file.file_size) ? `${(Number(file.file_size) / (1024 * 1024)).toFixed(1)} MB` : file.mime_type || 'Tệp'}</span></span>
                                        {!image && !video && <button type="button" onClick={() => onDownloadFile?.(file)} aria-label="Tải xuống" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Download size={14} /></button>}
                                    </div>;
                                })}
                            </div>
                        ) : <p className="rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-5 text-center text-[11px] text-slate-400">Chưa có tệp được chia sẻ.</p>}
                    </div>
                </div>
            </aside>
        )}

        </section>
    );
}
