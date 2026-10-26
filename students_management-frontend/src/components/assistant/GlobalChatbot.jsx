import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, LoaderCircle, Plus, Copy, Sparkles, MessageSquare, Pencil, Trash2, Check } from 'lucide-react';
import AssistantMessage from '@/components/assistant/AssistantMessage.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { useLanguage } from '@/context/LanguageContext.jsx';
import { streamChatbotMessage, getChatbotHistory, listChatbotConversations, createChatbotConversation, renameChatbotConversation, deleteChatbotConversation } from '@/api/chatbotApi.js';

export default function GlobalChatbot() {
    const { user } = useAuth();
    const { language } = useLanguage();
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState('default');
    const [showConversationList, setShowConversationList] = useState(false);
    const [editingConversationId, setEditingConversationId] = useState(null);
    const [editingTitle, setEditingTitle] = useState('');
    const scrollRef = useRef(null);
    const requestVersionRef = useRef(0);
    const streamAbortRef = useRef(null);
    const userKey = user?.id ?? user?.sub ?? user?.username ?? null;
    const isAdmin = user?.role === 'admin';
    const assistantTitle = isAdmin
        ? (language === 'vi' ? 'Trợ lý quản trị' : 'Admin assistant')
        : (language === 'vi' ? 'Trợ lý sinh viên' : 'Student assistant');

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
        setOpen(false);
    }, [userKey]);

    useEffect(() => {
        if (!open || !userKey) return undefined;
        let active = true;
        listChatbotConversations().then(result => {
            if (active && Array.isArray(result?.conversations)) {
                setConversations(result.conversations);
                if (result.conversations.length && !result.conversations.some(item => item.id === activeConversationId)) {
                    setActiveConversationId(result.conversations[0].id);
                }
            }
        }).catch(() => {});
        return () => { active = false; };
    }, [open, userKey]);

    useEffect(() => {
        if (!open || !userKey || messages.length > 0 || historyLoading) return undefined;
        let active = true;
        setHistoryLoading(true);
        getChatbotHistory(activeConversationId)
            .then(result => {
                if (!active || !Array.isArray(result?.messages)) return;
                setMessages(current => current.length > 0 ? current : result.messages.map((item, index) => ({ id: 'history-' + index + '-' + item.role, role: item.role, content: item.content })));
            })
            .catch(() => {})
            .finally(() => { setHistoryLoading(false); });
        return () => { active = false; };
    }, [open, userKey, activeConversationId]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading, open]);

    if (!user) return null;

    const switchConversation = async id => {
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
            setConversations(items => [result.conversation, ...items]);
            await switchConversation(result.conversation.id);
        } catch (error) {
            setMessages(items => [...items, { role: 'assistant', error: true, content: error?.response?.data?.message || 'Không thể tạo hội thoại mới.' }]);
        }
    };

    const saveConversationTitle = async id => {
        try {
            const result = await renameChatbotConversation(id, editingTitle);
            setConversations(items => items.map(item => item.id === id ? result.conversation : item));
            setEditingConversationId(null);
        } catch (error) {
            setMessages(items => [...items, { role: 'assistant', error: true, content: error?.response?.data?.message || 'Không thể đổi tên hội thoại.' }]);
        }
    };

    const removeConversation = async id => {
        if (loading || !window.confirm(language === 'vi' ? 'Xóa cuộc trò chuyện này? Thao tác không thể hoàn tác.' : 'Delete this conversation? This cannot be undone.')) return;
        try {
            await deleteChatbotConversation(id);
            const remaining = conversations.filter(item => item.id !== id);
            setConversations(remaining);
            if (id === activeConversationId) {
                setMessages([]);
                if (remaining.length) {
                    setActiveConversationId(remaining[0].id);
                    setMessages([]);
                } else {
                    setActiveConversationId('default');
                    setMessages([]);
                }
            }
        } catch (error) {
            setMessages(items => [...items, { role: 'assistant', error: true, content: error?.response?.data?.message || 'Không thể xóa hội thoại.' }]);
        }
    };

    const send = async (event, retryText = null) => {
        event?.preventDefault();
        const text = retryText ?? input.trim();
        if (!text || loading) return;

        setInput('');
        if (retryText === null) setMessages(items => [...items, { role: 'user', content: text }]);
        setLoading(true);
        const requestVersion = requestVersionRef.current;
        const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const abortController = new AbortController();
        streamAbortRef.current = abortController;
        try {
            setMessages(items => [...items, { id: assistantId, role: 'assistant', content: '', streaming: true }]);
            await streamChatbotMessage(text, {
                signal: abortController.signal,
                conversationId: activeConversationId,
                onToken: token => {
                    if (requestVersion !== requestVersionRef.current) return;
                    setMessages(items => items.map(item => item.id === assistantId
                        ? { ...item, content: item.content + token }
                        : item));
                },
                onDone: () => {
                    if (requestVersion !== requestVersionRef.current) return;
                    setMessages(items => items.map(item => item.id === assistantId
                        ? { ...item, streaming: false }
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
                    : [{ id: activeConversationId, title: text.slice(0, 80), createdAt: now, updatedAt: now }, ...items];
                return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
            });
        } catch (error) {
            if (error?.name === 'AbortError') return;
            const message = error?.response?.data?.message || error?.message || (language === 'vi'
                ? 'Không thể kết nối trợ lý lúc này. Vui lòng thử lại.'
                : 'The assistant is temporarily unavailable. Please try again.');
            if (requestVersion !== requestVersionRef.current) return;
            setMessages(items => {
                const partial = items.some(item => item.id === assistantId);
                return partial
                    ? items.map(item => item.id === assistantId ? { ...item, streaming: false, error: true, retryable: true, retryPrompt: text, content: item.content || message } : item)
                    : [...items, { id: assistantId, role: 'assistant', content: message, error: true, retryable: true, retryPrompt: text }];
            });
        } finally {
            if (streamAbortRef.current === abortController) streamAbortRef.current = null;
            if (requestVersion === requestVersionRef.current) setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-5 right-5 z-[70]">
            {open && (
                <section className="mb-3 flex h-[min(700px,calc(100dvh-110px))] w-[min(440px,calc(100vw-32px))] flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900" aria-label={language === 'vi' ? 'Trợ lý Student Manager' : 'Student Manager assistant'}>
                    <header className="flex items-center gap-3 border-b border-slate-100 bg-slate-950 px-4 py-3 text-white dark:border-slate-800">
                        <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-950/20"><Sparkles size={19} /></span>
                        <div className="min-w-0 flex-1">
                            <h2 className="m-0 text-sm font-semibold">{assistantTitle}</h2>
                            <p className="m-0 text-[11px] text-slate-300">{isAdmin
                                ? (language === 'vi' ? 'Hỗ trợ quản lý · Ollama' : 'Management support · Ollama')
                                : (language === 'vi' ? 'Hỗ trợ học tập · Ollama' : 'Study support · Ollama')}</p>
                        </div>
                        <button type="button" onClick={() => void startNewConversation()} disabled={loading} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label={language === 'vi' ? 'Cuộc trò chuyện mới' : 'New conversation'} title={language === 'vi' ? 'Cuộc trò chuyện mới' : 'New conversation'}><Plus size={18} /></button>
                        <button type="button" onClick={() => setShowConversationList(value => !value)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label={language === 'vi' ? 'Danh sách hội thoại' : 'Conversation list'} title={language === 'vi' ? 'Danh sách hội thoại' : 'Conversation list'}><MessageSquare size={17} /></button>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label={language === 'vi' ? 'Đóng trợ lý' : 'Close assistant'}><X size={18} /></button>
                    </header>
                    {showConversationList && <aside className="max-h-56 overflow-y-auto border-b border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                        {conversations.map(item => <div key={item.id} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${item.id === activeConversationId ? 'bg-blue-50 dark:bg-slate-800' : ''}`}>
                            {editingConversationId === item.id ? <><input autoFocus value={editingTitle} onChange={e => setEditingTitle(e.target.value)} maxLength={80} className="min-w-0 flex-1 rounded border px-2 py-1 text-xs dark:bg-slate-950" /><button onClick={() => void saveConversationTitle(item.id)} className="p-1 text-emerald-600"><Check size={14}/></button></> : <button onClick={() => void switchConversation(item.id)} disabled={loading} className="min-w-0 flex-1 truncate text-left text-xs text-slate-700 dark:text-slate-200">{item.title}</button>}
                            <button onClick={() => { setEditingConversationId(item.id); setEditingTitle(item.title); }} title={language === 'vi' ? 'Đổi tên' : 'Rename'} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={13}/></button>
                            <button onClick={() => void removeConversation(item.id)} title={language === 'vi' ? 'Xóa' : 'Delete'} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={13}/></button>
                        </div>)}
                        {conversations.length === 0 && <p className="px-2 py-3 text-xs text-slate-500">{language === 'vi' ? 'Chưa có hội thoại nào.' : 'No conversations yet.'}</p>}
                    </aside>}
                    <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4 dark:from-slate-950 dark:to-slate-900 sm:p-5">
                        {historyLoading && messages.length === 0 && <div className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle size={15} className="animate-spin" />{language === 'vi' ? 'Đang tải lịch sử…' : 'Loading history…'}</div>}
                        {messages.length === 0 && !historyLoading && (
                            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                                <p className="mb-2 font-semibold text-slate-900 dark:text-white">{isAdmin
                                    ? (language === 'vi' ? 'Xin chào quản trị viên! Tôi có thể hỗ trợ gì?' : 'Hello, administrator! How can I help?')
                                    : (language === 'vi' ? 'Xin chào! Tôi có thể giúp gì?' : 'Hello! How can I help?')}</p>
                                <p className="m-0 text-xs leading-5">{isAdmin
                                    ? (language === 'vi' ? 'Hỏi về danh mục môn học, khoa, lớp, học kỳ và số liệu tổng quan hệ thống. Trợ lý chỉ cung cấp thông tin, không tự thực hiện thao tác quản trị.' : 'Ask about subjects, departments, classes, semesters, and aggregate system counts. The assistant is read-only and cannot perform administrative actions.')
                                    : (language === 'vi' ? 'Hỏi về môn học, tín chỉ, khoa, lớp, học kỳ hoặc cách sử dụng Student Manager. Dữ liệu điểm cá nhân chưa được mở vì tài khoản sinh viên chưa có liên kết định danh đã xác minh.' : 'Ask about subjects, credits, departments, classes, semesters, or using Student Manager. Personal grades are not available until student-account identity linking is verified.')}</p>
                            </div>
                        )}
                        {messages.map((item, index) => (
                            <div key={item.id || index} className={`group flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`min-w-0 max-w-[94%] rounded-2xl px-3.5 py-3 sm:max-w-[90%] ${item.role === 'user' ? 'rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950/10' : 'rounded-bl-md border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'} ${item.error ? 'border-amber-300 dark:border-amber-800' : ''}`}>
                                    {item.role === 'assistant'
                                        ? <AssistantMessage content={item.content} />
                                        : <p className="m-0 whitespace-pre-wrap break-words text-[13px] leading-6">{item.content}</p>}
                                    {item.streaming && <span className="ml-1 inline-block h-3.5 w-1 animate-pulse rounded-full bg-blue-500 align-middle" />}
                                    {item.retryable && item.retryPrompt && (
                                        <button type="button" onClick={() => void send(null, item.retryPrompt)} disabled={loading} className="mt-3 block rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950">
                                            {language === 'vi' ? 'Thử gửi lại' : 'Try again'}
                                        </button>
                                    )}
                                    {item.role === 'assistant' && item.content && !item.streaming && (
                                        <div className="mt-2 flex justify-end border-t border-slate-100 pt-2 dark:border-slate-800">
                                            <button type="button" onClick={() => navigator.clipboard?.writeText(item.content)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"><Copy size={12} />{language === 'vi' ? 'Sao chép' : 'Copy'}</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && <div className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle size={15} className="animate-spin" />{language === 'vi' ? 'Đang suy nghĩ…' : 'Thinking…'}</div>}
                    </div>
                    <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(event); } }} rows={1} maxLength={4000} placeholder={language === 'vi' ? 'Nhập câu hỏi…' : 'Ask a question…'} className="max-h-32 min-h-11 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950" />
                        <button type="submit" disabled={!input.trim() || loading} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label={language === 'vi' ? 'Gửi tin nhắn' : 'Send message'}><Send size={17} /></button>
                    </form>
                    <p className="m-0 bg-white px-3 pb-2 text-[10px] text-slate-400 dark:bg-slate-900">{language === 'vi' ? 'AI có thể trả lời sai. Không nhập mật khẩu hoặc mã xác thực.' : 'AI can make mistakes. Never enter passwords or verification codes.'}</p>
                </section>
            )}
            <button type="button" onClick={() => setOpen(value => !value)} className="ml-auto flex size-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500" aria-label={open ? (language === 'vi' ? 'Đóng trợ lý' : 'Close assistant') : (language === 'vi' ? 'Mở trợ lý' : 'Open assistant')} title={assistantTitle}>
                {open ? <X size={22} /> : <MessageCircle size={23} />}
            </button>
        </div>
    );
}
