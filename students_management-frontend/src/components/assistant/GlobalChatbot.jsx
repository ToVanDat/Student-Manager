import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, X, LoaderCircle, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.js';
import { useLanguage } from '@/context/LanguageContext.jsx';
import { sendChatbotMessage, clearChatbotHistory } from '@/api/chatbotApi.js';

export default function GlobalChatbot() {
    const { user } = useAuth();
    const { language } = useLanguage();
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);
    const requestVersionRef = useRef(0);
    const userKey = user?.id ?? user?.sub ?? user?.username ?? null;
    const isAdmin = user?.role === 'admin';
    const assistantTitle = isAdmin
        ? (language === 'vi' ? 'Trợ lý quản trị' : 'Admin assistant')
        : (language === 'vi' ? 'Trợ lý sinh viên' : 'Student assistant');

    useEffect(() => {
        requestVersionRef.current += 1;
        setMessages([]);
        setInput('');
        setLoading(false);
        setOpen(false);
    }, [userKey]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading, open]);

    if (!user) return null;

    const resetConversation = async () => {
        if (loading) return;
        try {
            await clearChatbotHistory();
            setMessages([]);
        } catch (error) {
            setMessages(items => [...items, {
                role: 'assistant',
                error: true,
                content: error?.response?.data?.message || (language === 'vi'
                    ? 'Không thể tạo cuộc trò chuyện mới.'
                    : 'Could not start a new conversation.')
            }]);
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
        try {
            const result = await sendChatbotMessage(text);
            if (requestVersion !== requestVersionRef.current) return;
            setMessages(items => [...items, { role: 'assistant', content: result.message }]);
        } catch (error) {
            const message = error?.response?.data?.message || (language === 'vi'
                ? 'Không thể kết nối trợ lý lúc này. Vui lòng thử lại.'
                : 'The assistant is temporarily unavailable. Please try again.');
            if (requestVersion !== requestVersionRef.current) return;
            setMessages(items => [...items, { role: 'assistant', content: message, error: true, retryable: true, retryPrompt: text }]);
        } finally {
            if (requestVersion === requestVersionRef.current) setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-5 right-5 z-[70]">
            {open && (
                <section className="mb-3 flex h-[min(620px,calc(100dvh-110px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" aria-label={language === 'vi' ? 'Trợ lý Student Manager' : 'Student Manager assistant'}>
                    <header className="flex items-center gap-3 border-b border-slate-100 bg-slate-950 px-4 py-3 text-white dark:border-slate-800">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-white/10"><Bot size={20} /></span>
                        <div className="min-w-0 flex-1">
                            <h2 className="m-0 text-sm font-semibold">{assistantTitle}</h2>
                            <p className="m-0 text-[11px] text-slate-300">{isAdmin
                                ? (language === 'vi' ? 'Hỗ trợ quản lý · Ollama' : 'Management support · Ollama')
                                : (language === 'vi' ? 'Hỗ trợ học tập · Ollama' : 'Study support · Ollama')}</p>
                        </div>
                        <button type="button" onClick={() => void resetConversation()} disabled={loading} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label={language === 'vi' ? 'Cuộc trò chuyện mới' : 'New conversation'} title={language === 'vi' ? 'Cuộc trò chuyện mới' : 'New conversation'}><Plus size={18} /></button>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label={language === 'vi' ? 'Đóng trợ lý' : 'Close assistant'}><X size={18} /></button>
                    </header>
                    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950">
                        {messages.length === 0 && (
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
                            <div key={index} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 ${item.role === 'user' ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'} ${item.error ? 'border-amber-300 dark:border-amber-800' : ''}`}>
                                    {item.content}
                                    {item.retryable && item.retryPrompt && (
                                        <button type="button" onClick={() => void send(null, item.retryPrompt)} disabled={loading} className="mt-2 block rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950">
                                            {language === 'vi' ? 'Thử gửi lại' : 'Try again'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && <div className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle size={15} className="animate-spin" />{language === 'vi' ? 'Đang suy nghĩ…' : 'Thinking…'}</div>}
                    </div>
                    <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(event); } }} rows={1} maxLength={4000} placeholder={language === 'vi' ? 'Nhập câu hỏi…' : 'Ask a question…'} className="max-h-28 min-h-10 flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
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
