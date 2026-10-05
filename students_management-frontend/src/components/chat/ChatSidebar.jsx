import React, { useEffect, useState } from 'react';
import { Search, SquarePen, X } from 'lucide-react';
import ConversationItem from './ConversationItem';

export default function ChatSidebar({
    conversations,
    activeId,
    onSelectConversation,
    searchUsers,
    searchResults,
    onStartConversation
}) {
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewChat, setShowNewChat] = useState(false);
    const [userSearch, setUserSearch] = useState('');

    const unreadTotal = conversations.reduce(
        (acc, curr) => acc + (curr.unreadCount || 0),
        0
    );

    useEffect(() => {
        if (!showNewChat) return;
        const timer = setTimeout(() => searchUsers(userSearch), 250);
        return () => clearTimeout(timer);
    }, [showNewChat, userSearch, searchUsers]);

    const filteredConversations = conversations.filter(item => {
        const name = item.name || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            (filter === 'all' || item.unreadCount > 0);
    });

    return (
        <div className="w-80 bg-white border-r border-slate-100 flex flex-col h-full p-4 rounded-l-2xl relative">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Tin nhắn</h2>
                <button
                    onClick={() => setShowNewChat(true)}
                    className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                    title="Tin nhắn mới"
                >
                    <SquarePen size={18} />
                </button>
            </div>

            {showNewChat && (
                <div className="absolute z-20 left-4 right-4 top-16 bg-white border border-slate-200 rounded-xl shadow-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">Tin nhắn mới</span>
                        <button onClick={() => setShowNewChat(false)}>
                            <X size={16} />
                        </button>
                    </div>

                    <input
                        autoFocus
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder="Tìm username..."
                        className="w-full px-3 py-2 text-sm bg-slate-50 rounded-lg outline-none"
                    />

                    <div className="mt-2 max-h-52 overflow-y-auto">
                        {searchResults.map(user => (
                            <button
                                key={user.id}
                                onClick={async () => {
                                    await onStartConversation(user.id);
                                    setShowNewChat(false);
                                    setUserSearch('');
                                }}
                                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 text-left"
                            >
                                <img
                                    src={user.avatar || 'https://via.placeholder.com/40'}
                                    className="w-9 h-9 rounded-full object-cover"
                                    alt=""
                                />
                                <span className="text-sm font-medium">{user.username}</span>
                            </button>
                        ))}
                        {userSearch && searchResults.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-3">
                                Không tìm thấy người dùng
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Tìm kiếm cuộc trò chuyện..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none"
                />
            </div>

            <div className="flex gap-2 mb-3 bg-slate-50 p-1 rounded-xl">
                <button
                    onClick={() => setFilter('all')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${filter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                >
                    Tất cả <span className="ml-1">{conversations.length}</span>
                </button>
                <button
                    onClick={() => setFilter('unread')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${filter === 'unread' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                >
                    Chưa đọc {unreadTotal > 0 && <span className="ml-1">{unreadTotal}</span>}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {filteredConversations.map(item => (
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