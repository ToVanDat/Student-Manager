import React, { useState } from 'react';
import { Paperclip, Smile, Send } from 'lucide-react';

export default function MessageInput({ onSendMessage }) {
    const [input, setInput] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-100 flex items-center gap-2">
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
                className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
                <Send size={18} />
            </button>
        </form>
    );
}