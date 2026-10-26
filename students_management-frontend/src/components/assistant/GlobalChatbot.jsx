import { useEffect, useMemo, useRef, useState } from 'react';
import {
    BookOpen, Check, ChevronDown, Copy, LoaderCircle, MessageCircle, MessageSquare,
    MoreHorizontal, Pencil, Plus, Search, Send, Sparkles, Square, Trash2, X
} from 'lucide-react';
import AssistantMessage from '@/components/assistant/AssistantMessage.jsx';
import AssistantKnowledgeManager from '@/components/assistant/AssistantKnowledgeManager.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { useLanguage } from '@/context/LanguageContext.jsx';
import {
    streamChatbotMessage, getChatbotHistory, listChatbotConversations,
    createChatbotConversation, renameChatbotConversation, deleteChatbotConversation
} from '@/api/chatbotApi.js';

const QUICK_PROMPTS = {
    vi: [
        'Tôi có thể tra cứu những thông tin nào?',
        'Hướng dẫn đăng ký học phần',
        'Điều kiện xét tốt nghiệp là gì?'
    ],
    en: [
        'What information can I look up?',
        'How do I register for courses?',
        'What are the graduation requirements?'
    ]
};

export default function GlobalChatbot() {
    const { user } = useAuth();
    const { language } = useLanguage();
    const vi = language === 'vi';
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState('default');
    const [showConversationList, setShowConversationList] = useState(false);
    const [showKnowledgeManager, setShowKnowledgeManager] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingConversationId, setEditingConversationId] = useState(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [copiedMessageId, setCopiedMessageId] = useState(null);
    const scrollRef = useRef(null);
    const requestVersionRef = useRef(0);
    const streamAbortRef = useRef(null);
    const textareaRef = useRef(null);
    const userKey = user?.id ?? user?.sub ?? user?.username ?? null;
    const isAdmin = user?.role === 'admin';
    const assistantTitle = isAdmin
        ? (vi ? 'Trợ lý quản trị' : 'Admin assistant')
        : (vi ? 'Trợ lý sinh viên' : 'Student assistant');

    const filteredConversations = useMemo(() => {
        const query = searchTerm.trim().toLocaleLowerCase();
        if (!query) return conversations;
        return conversations.filter(item => String(item.title || '').toLocaleLowerCase().includes(query));
    }, [conversations, searchTerm]);

    useEffect(() => {
        requestVersionRef.current += 1;
        streamAbortRef.current?.abort();
        streamAbortRef.current = null;
        setMessages([]);
        setInput('');
        setLoading(false);
        setHistoryLoading(false);
        setConversations([]);
        setActiveConversationId('default');
        setShowConversationList(false);
        setShowKnowledgeManager(false);
        setOpen(false);
    }, [userKey]);

    useEffect(() => {
        if (!open || !userKey) return undefined;
        let active = true;
        listChatbotConversations().then(result => {
            if (!active || !Array.isArray(result?.conversations)) return;
            setConversations(result.conversations);
            if (result.conversations.length && !result.conversations.some(item => item.id === activeConversationId)) {
                setActiveConversationId(result.conversations[0].id);
            }
        }).catch(() => {
            if (active) setConversations([]);
        });
        return () => { active = false; };
    }, [open, userKey]);

    useEffect(() => {
        if (!open || !userKey || messages.length > 0 || historyLoading) return undefined;
        let active = true;
        setHistoryLoading(true);
        getChatbotHistory(activeConversationId)
            .then(result => {
                if (!active || !Array.isArray(result?.messages)) return;
                setMessages(current => current.length > 0 ? current : result.messages.map((item, index) => ({
                    id: 'history-' + index + '-' + item.role,
                    role: item.role,
                    content: item.content
                })));
            })
            .catch(() => {
                if (active) setMessages([]);
            })
            .finally(() => {
                if (active) setHistoryLoading(false);
            });
        return () => { active = false; };
    }, [open, userKey, activeConversationId]);

    useEffect(() => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading, open]);

    useEffect(() => {
        if (open && !showConversationList && !showKnowledgeManager) {
            textareaRef.current?.focus({ preventScroll: true });
        }
    }, [open, showConversationList, showKnowledgeManager]);

    if (!user) return null;

    const switchConversation = id => {
        if (loading || id === activeConversationId) return;
        streamAbortRef.current?.abort();
        requestVersionRef.current += 1;
        setLoading(false);
        setActiveConversationId(id);
        setMessages([]);
        setShowConversationList(false);
    };

    const startNewConversation = async () => {
        if (loading) return;
        try {
            const result = await createChatbotConversation();
            if (!result?.conversation?.id) return;
            setConversations(items => [result.conversation, ...items.filter(item => item.id !== result.conversation.id)]);
            setMessages([]);
            setActiveConversationId(result.conversation.id);
            setShowConversationList(false);
            setShowKnowledgeManager(false);
        } catch (error) {
            setMessages(items => [...items, {
                role: 'assistant', error: true,
                content: error?.response?.data?.message || (vi ? 'Không thể tạo hội thoại mới.' : 'Could not create a conversation.')
            }]);
        }
    };

    const saveConversationTitle = async id => {
        const title = editingTitle.trim();
        if (!title) return;
        try {
            const result = await renameChatbotConversation(id, title);
            setConversations(items => items.map(item => item.id === id ? result.conversation : item));
            setEditingConversationId(null);
            setEditingTitle('');
        } catch (error) {
            setMessages(items => [...items, {
                role: 'assistant', error: true,
                content: error?.response?.data?.message || (vi ? 'Không thể đổi tên hội thoại.' : 'Could not rename conversation.')
            }]);
        }
    };

    const removeConversation = async id => {
        if (loading || !window.confirm(vi
            ? 'Xóa cuộc trò chuyện này? Thao tác không thể hoàn tác.'
            : 'Delete this conversation? This cannot be undone.')) return;
        try {
            await deleteChatbotConversation(id);
            const remaining = conversations.filter(item => item.id !== id);
            setConversations(remaining);
            if (id === activeConversationId) {
                setMessages([]);
                setActiveConversationId(remaining[0]?.id || 'default');
            }
        } catch (error) {
            setMessages(items => [...items, {
                role: 'assistant', error: true,
                content: error?.response?.data?.message || (vi ? 'Không thể xóa hội thoại.' : 'Could not delete conversation.')
            }]);
        }
    };

    const send = async (event, retryText = null) => {
        event?.preventDefault();
        const prompt = retryText ?? input.trim();
        if (!prompt || loading) return;

        setInput('');
        if (retryText === null) setMessages(items => [...items, {
            id: 'user-' + Date.now(), role: 'user', content: prompt
        }]);
        setLoading(true);
        const requestVersion = requestVersionRef.current;
        const assistantId = 'assistant-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        const abortController = new AbortController();
        streamAbortRef.current = abortController;

        setMessages(items => [...items, { id: assistantId, role: 'assistant', content: '', streaming: true }]);
        try {
            await streamChatbotMessage(prompt, {
                signal: abortController.signal,
                conversationId: activeConversationId,
                onToken: token => {
                    if (requestVersion !== requestVersionRef.current) return;
                    setMessages(items => items.map(item => item.id === assistantId
                        ? { ...item, content: item.content + token }
                        : item));
                },
                onDone: data => {
                    if (requestVersion !== requestVersionRef.current) return;
                    const sources = Array.isArray(data?.context?.sources) ? data.context.sources : [];
                    setMessages(items => items.map(item => item.id === assistantId
                        ? { ...item, streaming: false, sources, model: data?.model || null }
                        : item));
                }
            });
            if (requestVersion !== requestVersionRef.current) return;
            setMessages(items => items.map(item => item.id === assistantId ? { ...item, streaming: false } : item));
            setConversations(items => {
                const now = new Date().toISOString();
                const existing = items.find(item => item.id === activeConversationId);
                const next = existing
                    ? items.map(item => item.id === activeConversationId ? { ...item, updatedAt: now } : item)
                    : [{ id: activeConversationId, title: prompt.slice(0, 80), createdAt: now, updatedAt: now }, ...items];
                return next.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
            });
        } catch (error) {
            if (error?.name === 'AbortError' || abortController.signal.aborted) return;
            const message = error?.message || (vi
                ? 'Không thể kết nối trợ lý lúc này. Vui lòng thử lại.'
                : 'The assistant is temporarily unavailable. Please try again.');
            if (requestVersion !== requestVersionRef.current) return;
            setMessages(items => items.map(item => item.id === assistantId
                ? { ...item, streaming: false, error: true, retryable: true, retryPrompt: prompt, content: item.content || message }
                : item));
        } finally {
            if (streamAbortRef.current === abortController) streamAbortRef.current = null;
            if (requestVersion === requestVersionRef.current) setLoading(false);
        }
    };

    const stopGeneration = () => {
        if (!streamAbortRef.current) return;
        streamAbortRef.current.abort();
        streamAbortRef.current = null;
        setMessages(items => items.map(item => item.streaming
            ? { ...item, streaming: false, stopped: true }
            : item));
        setLoading(false);
    };

    const copyMessage = async (id, content) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(id);
            window.setTimeout(() => setCopiedMessageId(current => current === id ? null : current), 1600);
        } catch {
            setCopiedMessageId(null);
        }
    };

    const panelTitle = showKnowledgeManager
        ? (vi ? 'Kho tri thức' : 'Knowledge base')
        : showConversationList
            ? (vi ? 'Lịch sử hội thoại' : 'Conversation history')
            : assistantTitle;

    return (
        <div className="fixed bottom-4 right-4 z-[70] sm:bottom-5 sm:right-5">
            {open && (
                <section
                    className="fixed inset-2 flex flex-col overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_28px_100px_-30px_rgba(15,23,42,.55)] dark:border-slate-700 dark:bg-slate-950 sm:absolute sm:inset-auto sm:bottom-16 sm:right-0 sm:h-[min(760px,calc(100dvh-112px))] sm:w-[min(500px,calc(100vw-40px))]"
                    aria-label={vi ? 'Trợ lý Student Manager' : 'Student Manager assistant'}
                    aria-live="off"
                >
                    <header className="relative flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                            <Sparkles size={19} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h2 className="m-0 truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">{panelTitle}</h2>
                                {!showKnowledgeManager && !showConversationList && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">AI</span>}
                            </div>
                            <p className="m-0 mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {showKnowledgeManager
                                    ? (vi ? 'Tài liệu tham khảo được quản lý bởi admin' : 'Documents managed by administrators')
                                    : showConversationList
                                        ? (vi ? 'Các cuộc trò chuyện gần đây' : 'Your recent conversations')
                                        : (isAdmin
                                            ? (vi ? 'Trợ lý quản trị · Student Manager' : 'Management assistant · Student Manager')
                                            : (vi ? 'Trợ lý học tập · Student Manager' : 'Study assistant · Student Manager'))}
                            </p>
                        </div>
                        {!showKnowledgeManager && !showConversationList && (
                            <>
                                <button type="button" onClick={() => void startNewConversation()} disabled={loading} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={vi ? 'Cuộc trò chuyện mới' : 'New conversation'} title={vi ? 'Cuộc trò chuyện mới' : 'New conversation'}>
                                    <Plus size={18} />
                                </button>
                                <button type="button" onClick={() => setShowConversationList(true)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={vi ? 'Lịch sử hội thoại' : 'Conversation history'} title={vi ? 'Lịch sử hội thoại' : 'Conversation history'}>
                                    <MessageSquare size={18} />
                                </button>
                                {isAdmin && <button type="button" onClick={() => setShowKnowledgeManager(true)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={vi ? 'Kho tri thức' : 'Knowledge base'} title={vi ? 'Kho tri thức' : 'Knowledge base'}>
                                    <BookOpen size={18} />
                                </button>}
                            </>
                        )}
                        {(showKnowledgeManager || showConversationList) && (
                            <button type="button" onClick={() => { setShowKnowledgeManager(false); setShowConversationList(false); }} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={vi ? 'Quay lại hội thoại' : 'Back to chat'}>
                                <ChevronDown size={18} className="rotate-90" />
                            </button>
                        )}
                        <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={vi ? 'Đóng trợ lý' : 'Close assistant'}>
                            <X size={19} />
                        </button>
                    </header>

                    {isAdmin && showKnowledgeManager ? (
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <AssistantKnowledgeManager language={language} />
                        </div>
                    ) : showConversationList ? (
                        <aside className="flex min-h-0 flex-1 flex-col bg-slate-50/80 p-3 dark:bg-slate-900/50">
                            <label className="relative mb-3 block">
                                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder={vi ? 'Tìm trong hội thoại...' : 'Search conversations...'} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                            </label>
                            <button type="button" onClick={() => void startNewConversation()} disabled={loading} className="mb-2 flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40">
                                <Plus size={16} />{vi ? 'Cuộc trò chuyện mới' : 'New conversation'}
                            </button>
                            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                                {filteredConversations.map(item => (
                                    <div key={item.id} className={`group flex items-center gap-1 rounded-xl border px-2 py-2 transition ${item.id === activeConversationId ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40' : 'border-transparent hover:border-slate-200 hover:bg-white dark:hover:border-slate-700 dark:hover:bg-slate-900'}`}>
                                        {editingConversationId === item.id ? (
                                            <>
                                                <input autoFocus value={editingTitle} onChange={event => setEditingTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void saveConversationTitle(item.id); if (event.key === 'Escape') setEditingConversationId(null); }} maxLength={80} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                                                <button type="button" onClick={() => void saveConversationTitle(item.id)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950" aria-label={vi ? 'Lưu tên' : 'Save title'}><Check size={15} /></button>
                                            </>
                                        ) : (
                                            <button type="button" onClick={() => switchConversation(item.id)} disabled={loading} className="min-w-0 flex-1 truncate px-1 py-1 text-left text-xs font-medium text-slate-700 disabled:opacity-50 dark:text-slate-200">
                                                {item.title || (vi ? 'Cuộc trò chuyện mới' : 'New conversation')}
                                            </button>
                                        )}
                                        <button type="button" onClick={() => { setEditingConversationId(item.id); setEditingTitle(item.title || ''); }} className="rounded-lg p-2 text-slate-400 opacity-100 transition hover:bg-slate-100 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100" aria-label={vi ? 'Đổi tên' : 'Rename'}><Pencil size={14} /></button>
                                        <button type="button" onClick={() => void removeConversation(item.id)} disabled={loading} className="rounded-lg p-2 text-slate-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-red-950/40" aria-label={vi ? 'Xóa hội thoại' : 'Delete conversation'}><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                {filteredConversations.length === 0 && (
                                    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                                        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm dark:bg-slate-900"><Search size={20} /></div>
                                        <p className="m-0 text-sm font-medium text-slate-700 dark:text-slate-200">{vi ? 'Không tìm thấy hội thoại' : 'No conversations found'}</p>
                                        <p className="mb-0 mt-1 text-xs text-slate-400">{vi ? 'Thử từ khóa khác hoặc tạo cuộc trò chuyện mới.' : 'Try another keyword or start a new conversation.'}</p>
                                    </div>
                                )}
                            </div>
                        </aside>
                    ) : (
                        <>
                            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/70 via-slate-50 to-white px-4 py-5 dark:from-blue-950/20 dark:via-slate-950 dark:to-slate-950 sm:px-5">
                                {historyLoading && messages.length === 0 && (
                                    <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500"><LoaderCircle size={15} className="animate-spin" />{vi ? 'Đang tải lịch sử...' : 'Loading conversation...'}</div>
                                )}
                                {messages.length === 0 && !historyLoading && (
                                    <div className="mx-auto flex min-h-full max-w-sm flex-col items-center justify-center py-6 text-center">
                                        <div className="mb-4 flex size-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xl shadow-blue-500/20"><Sparkles size={27} /></div>
                                        <p className="m-0 text-lg font-bold tracking-tight text-slate-900 dark:text-white">{vi ? (isAdmin ? 'Xin chào quản trị viên!' : 'Xin chào!') : (isAdmin ? 'Hello, administrator!' : 'Hello!')}</p>
                                        <p className="mb-5 mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{vi
                                            ? (isAdmin ? 'Tôi có thể hỗ trợ tra cứu danh mục và số liệu quản lý trong phạm vi được cấp quyền.' : 'Tôi có thể hỗ trợ bạn tra cứu thông tin học tập và hướng dẫn sử dụng Student Manager.')
                                            : (isAdmin ? 'I can help explore management catalogs and authorized system summaries.' : 'I can help you find academic information and navigate Student Manager.')}</p>
                                        <div className="grid w-full gap-2 text-left">
                                            {QUICK_PROMPTS[vi ? 'vi' : 'en'].map((prompt, index) => (
                                                <button key={prompt} type="button" onClick={() => { setInput(prompt); textareaRef.current?.focus(); }} className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-left text-xs font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:text-blue-300">
                                                    <span>{prompt}</span><span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500">↗</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-5">
                                    {messages.map((item, index) => (
                                        <div key={item.id || index} className={`group flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {item.role === 'assistant' && (
                                                <div className="mr-2 mt-1 flex size-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white"><Sparkles size={14} /></div>
                                            )}
                                            <div className={`min-w-0 max-w-[88%] rounded-[20px] px-4 py-3.5 sm:max-w-[86%] ${item.role === 'user'
                                                ? 'rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/10'
                                                : 'rounded-bl-md border border-slate-200/80 bg-white/95 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'} ${item.error ? 'border-amber-300 dark:border-amber-800' : ''}`}>
                                                {item.role === 'assistant'
                                                    ? <AssistantMessage content={item.content} />
                                                    : <p className="m-0 whitespace-pre-wrap break-words text-[13px] leading-6">{item.content}</p>}
                                                {item.sources?.length > 0 && (
                                                    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                                                        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400"><BookOpen size={12} />{vi ? 'Nguồn tham khảo' : 'Sources'}</p>
                                                        <div className="space-y-1.5">
                                                            {item.sources.map((source, sourceIndex) => (
                                                                <div key={source.documentId || sourceIndex} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-4 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                                                                    <BookOpen size={13} className="mt-0.5 shrink-0 text-blue-500" />
                                                                    <span>{source.title}{source.pageNumber ? ` · ${vi ? 'trang' : 'page'} ${source.pageNumber}` : ''}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {item.streaming && <span className="ml-1 inline-block h-3.5 w-1 animate-pulse rounded-full bg-blue-500 align-middle" />}
                                                {item.stopped && <p className="mb-0 mt-2 text-[10px] text-slate-400">{vi ? 'Đã dừng tạo câu trả lời.' : 'Generation stopped.'}</p>}
                                                {item.retryable && item.retryPrompt && (
                                                    <button type="button" onClick={() => void send(null, item.retryPrompt)} disabled={loading} className="mt-3 rounded-xl border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950">
                                                        {vi ? 'Thử lại' : 'Try again'}
                                                    </button>
                                                )}
                                                {item.role === 'assistant' && item.content && !item.streaming && (
                                                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                                                        <span className="text-[10px] text-slate-400">{item.model || 'AI Assistant'}</span>
                                                        <button type="button" onClick={() => void copyMessage(item.id || String(index), item.content)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                                                            {copiedMessageId === (item.id || String(index)) ? <Check size={12} /> : <Copy size={12} />}
                                                            {copiedMessageId === (item.id || String(index)) ? (vi ? 'Đã sao chép' : 'Copied') : (vi ? 'Sao chép' : 'Copy')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {loading && (
                                    <div className="mt-4 flex items-center gap-2 pl-9 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="flex gap-1"><i className="size-1.5 animate-bounce rounded-full bg-blue-500" /><i className="size-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:120ms]" /><i className="size-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:240ms]" /></span>
                                        {vi ? 'Đang tạo câu trả lời...' : 'Generating response...'}
                                    </div>
                                )}
                            </div>

                            <div className="shrink-0 border-t border-slate-200/80 bg-white px-3 pb-2 pt-3 dark:border-slate-800 dark:bg-slate-950 sm:px-4">
                                <form onSubmit={send} className="rounded-[20px] border border-slate-200 bg-slate-50 p-2 shadow-sm transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:bg-slate-900">
                                    <textarea
                                        ref={textareaRef}
                                        value={input}
                                        onChange={event => setInput(event.target.value)}
                                        onKeyDown={event => {
                                            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                                event.preventDefault();
                                                void send(event);
                                            }
                                        }}
                                        rows={2}
                                        maxLength={4000}
                                        placeholder={vi ? 'Nhắn tin cho trợ lý...' : 'Message the assistant...'}
                                        aria-label={vi ? 'Nội dung câu hỏi' : 'Your message'}
                                        className="max-h-32 min-h-12 w-full resize-y bg-transparent px-2 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
                                    />
                                    <div className="flex items-center justify-between gap-2 px-1">
                                        <span className="text-[10px] text-slate-400">{vi ? 'Enter để gửi · Shift + Enter xuống dòng' : 'Enter to send · Shift + Enter for a new line'}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] tabular-nums text-slate-400">{input.length}/4000</span>
                                            {loading ? (
                                                <button type="button" onClick={stopGeneration} className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-red-600 dark:bg-slate-700" aria-label={vi ? 'Dừng tạo câu trả lời' : 'Stop generating'} title={vi ? 'Dừng tạo câu trả lời' : 'Stop generating'}>
                                                    <Square size={14} fill="currentColor" />
                                                </button>
                                            ) : (
                                                <button type="submit" disabled={!input.trim()} className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0" aria-label={vi ? 'Gửi tin nhắn' : 'Send message'}>
                                                    <Send size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </form>
                                <p className="mb-0 mt-2 text-center text-[10px] leading-4 text-slate-400">{vi ? 'AI có thể mắc lỗi. Không nhập mật khẩu hoặc mã xác thực.' : 'AI can make mistakes. Never enter passwords or verification codes.'}</p>
                            </div>
                        </>
                    )}
                </section>
            )}
            {!open && (
                <button type="button" onClick={() => setOpen(true)} className="ml-auto flex size-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-950/25 transition hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500" aria-label={vi ? 'Mở trợ lý AI' : 'Open AI assistant'} title={assistantTitle}>
                    <MessageCircle size={23} />
                </button>
            )}
        </div>
    );
}
