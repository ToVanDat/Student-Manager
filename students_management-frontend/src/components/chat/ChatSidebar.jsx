import React, { useEffect, useState } from 'react';
import { Search, SquarePen, X, Users, Check, Phone } from 'lucide-react';
import ConversationItem from './ConversationItem';
import AvatarFallback from './AvatarFallback';

export default function ChatSidebar({
    conversations,
    activeId,
    onSelectConversation,
    searchUsers,
    searchResults,
    onStartConversation,
    onStartGroupConversation,
    onOpenCallCenter,
    onlineUserIds = new Set()
}) {
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewChat, setShowNewChat] = useState(false);
    const [mode, setMode] = useState('direct');
    const [userSearch, setUserSearch] = useState('');
    const [groupName, setGroupName] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [startingDirectId, setStartingDirectId] = useState(null);
    const [newChatError, setNewChatError] = useState('');

    const unreadTotal = conversations.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);

    useEffect(() => {
        if (!showNewChat) return;
        const timer = setTimeout(() => searchUsers(userSearch), 250);
        return () => clearTimeout(timer);
    }, [showNewChat, userSearch, searchUsers]);

    const getIsOnline = conversation => conversation.type === 'direct'
        && onlineUserIds.has(Number(conversation.userId));

    const filteredConversations = conversations.filter(item => {
        const name = item.name || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            (filter === 'all' || item.unreadCount > 0);
    });

    const closeNewChat = () => {
        setShowNewChat(false);
        setNewChatError('');
        setStartingDirectId(null);
        setMode('direct');
        setUserSearch('');
        setGroupName('');
        setSelectedIds([]);
    };

    const toggleMember = (userId) => {
        const id = Number(userId);
        setSelectedIds(prev => prev.includes(id)
            ? prev.filter(item => item !== id)
            : [...prev, id]
        );
    };

    const handleStartDirectConversation = async (userId) => {
        if (!userId || !onStartConversation || startingDirectId) return;

        try {
            setNewChatError('');
            setStartingDirectId(Number(userId));
            const conversation = await onStartConversation(Number(userId));

            if (!conversation?.id) {
                throw new Error('Không nhận được conversation từ server');
            }

            closeNewChat();
        } catch (error) {
            console.error('Không thể mở cuộc trò chuyện:', error);
            setNewChatError(
                error?.response?.data?.message ||
                error?.message ||
                'Không thể bắt đầu cuộc trò chuyện'
            );
        } finally {
            setStartingDirectId(null);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedIds.length < 1 || !onStartGroupConversation) return;

        try {
            setCreatingGroup(true);
            await onStartGroupConversation(groupName.trim(), selectedIds);
            closeNewChat();
        } catch (error) {
            console.error('Không thể tạo group:', error);
        } finally {
            setCreatingGroup(false);
        }
    };

    return (
        <div className="w-[360px] min-w-[360px] bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col h-full p-5 relative">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-[24px] leading-8 font-bold tracking-[-0.02em] text-slate-900 dark:text-slate-100">Tin nhắn</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setShowNewChat(true); setMode('group'); }}
                        className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl"
                        title="Tạo nhóm"
                    >
                        <Users size={18} />
                    </button>
                    <button
                        onClick={onOpenCallCenter}
                        className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl"
                        title="Cuộc gọi"
                    >
                        <Phone size={18} />
                    </button>
                    <button
                        data-new-chat
                        onClick={() => { setShowNewChat(true); setMode('direct'); }}
                        className="w-10 h-10 flex items-center justify-center text-white bg-[#4b63f5] hover:bg-[#3f56e8] rounded-xl shadow-sm"
                        title="Tin nhắn mới"
                    >
                        <SquarePen size={18} />
                    </button>
                </div>
            </div>

            {showNewChat && (
                <div className="absolute z-30 left-5 right-5 top-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMode('direct')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${mode === 'direct' ? 'bg-blue-50 text-blue-600' : 'text-slate-500'}`}
                            >
                                Tin nhắn mới
                            </button>
                            <button
                                onClick={() => setMode('group')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${mode === 'group' ? 'bg-blue-50 text-blue-600' : 'text-slate-500'}`}
                            >
                                Tạo nhóm
                            </button>
                        </div>
                        <button onClick={closeNewChat}><X size={16} /></button>
                    </div>

                    {mode === 'group' && (
                        <input
                            autoFocus
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            placeholder="Tên nhóm..."
                            className="w-full mb-2 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg outline-none"
                        />
                    )}

                    <input
                        autoFocus={mode === 'direct'}
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder={mode === 'group' ? 'Tìm và chọn thành viên...' : 'Tìm username, email...'}
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg outline-none"
                    />

                    {mode === 'group' && selectedIds.length > 0 && (
                        <p className="text-xs text-blue-500 mt-2">Đã chọn {selectedIds.length} thành viên</p>
                    )}
                    {newChatError && (
                        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                            {newChatError}
                        </p>
                    )}

                    <div className="mt-2 max-h-52 overflow-y-auto">
                        {searchResults.map(user => {
                            const selected = selectedIds.includes(Number(user.id));
                            return (
                                <button
                                    key={user.id}
                                    onClick={async () => {
                                        if (mode === 'group') {
                                            toggleMember(user.id);
                                            return;
                                        }
                                        await handleStartDirectConversation(user.id);
                                    }}
                                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                                >
                                    <AvatarFallback name={user.username} src={user.avatar} size="md" />
                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100 flex-1">{user.username}</span>
                                    {mode === 'group' && selected && <Check size={16} className="text-blue-500" />}
                                    {mode === 'direct' && startingDirectId === Number(user.id) && (
                                        <span className="text-xs text-blue-500">Đang mở...</span>
                                    )}
                                </button>
                            );
                        })}
                        {userSearch && searchResults.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-3">Không tìm thấy người dùng</p>
                        )}
                    </div>

                    {mode === 'group' && (
                        <button
                            type="button"
                            disabled={!groupName.trim() || selectedIds.length < 1 || creatingGroup}
                            onClick={handleCreateGroup}
                            className="w-full mt-3 h-10 rounded-lg bg-[#4b63f5] text-white text-sm font-semibold disabled:opacity-50"
                        >
                            {creatingGroup ? 'Đang tạo...' : 'Tạo nhóm'}
                        </button>
                    )}
                </div>
            )}

            <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Tìm kiếm cuộc trò chuyện..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-[#f4f7fb] dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-transparent rounded-xl text-sm outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                />
            </div>

            <div className="flex mt-4 mb-3 bg-[#f5f7fb] p-1 rounded-xl">
                <button
                    onClick={() => setFilter('all')}
                    className={`flex-1 h-9 text-sm font-semibold rounded-lg ${filter === 'all' ? 'bg-[#4b63f5] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Tất cả <span className="ml-1">{conversations.length}</span>
                </button>
                <button
                    onClick={() => setFilter('unread')}
                    className={`flex-1 h-9 text-sm font-semibold rounded-lg ${filter === 'unread' ? 'bg-[#4b63f5] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Chưa đọc {unreadTotal > 0 && <span className="ml-1">{unreadTotal}</span>}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {filteredConversations.map(item => (
                    <ConversationItem
                        key={item.id}
                        conversation={item}
                        isSelected={Number(item.id) === Number(activeId)}
                        onClick={() => onSelectConversation(item.id)}
                    />
                ))}
            </div>
        </div>
    );
}
