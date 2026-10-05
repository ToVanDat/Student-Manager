import React, { useState } from 'react';
import { Search, SquarePen } from 'lucide-react';
import ConversationItem from './ConversationItem';

export default function ChatSidebar({ conversations, activeId, onSelectConversation }) {
    const [filter, setFilter] = useState('all'); // 'all' | 'unread'
    const [searchTerm, setSearchTerm] = useState('');

    const unreadTotal = conversations.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);

    const filteredConversations = conversations.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'unread' ? item.unreadCount > 0 : true;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="w-80 bg-white border-r border-slate-100 flex flex-col h-full p-4 rounded-l-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Tin nhắn</h2>
                <button className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                    <SquarePen size={18} />
                </button>
            </div>

            {/* Search input */}
            <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Tìm kiếm cuộc trò chuyện..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-3 bg-slate-50 p-1 rounded-xl">
                <button
                    onClick={() => setFilter('all')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        filter === 'all'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    Tất cả
                    <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {conversations.length}
                    </span>
                </button>
                <button
                    onClick={() => setFilter('unread')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        filter === 'unread'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    Chưa đọc
                    {unreadTotal > 0 && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${filter === 'unread' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'}`}>
                            {unreadTotal}
                        </span>
                    )}
                </button>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredConversations.map((item) => (
                    <ConversationItem
                        key={item.id}
                        conversation={item}
                        isSelected={item.id === activeId}
                        onClick={() => onSelectConversation(item.id)}
                    />
                ))}
            </div>
        </div>
    );
}