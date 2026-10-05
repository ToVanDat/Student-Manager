import React from 'react';

export default function ConversationItem({ conversation, isSelected, onClick }) {
    const { name, avatar, lastMessage, lastMessageAt, unreadCount, isOnline } = conversation;

    const time = lastMessageAt
        ? new Date(lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${isSelected ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'}`}
        >
            <div className="relative flex-shrink-0">
                <img
                    src={avatar || 'https://via.placeholder.com/40'}
                    alt={name}
                    className="w-11 h-11 rounded-full object-cover"
                />
                {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                    <h4 className="text-sm font-semibold truncate text-slate-800">{name}</h4>
                    <span className="text-xs text-slate-400 ml-2">{time}</span>
                </div>
                <p className={`text-xs truncate ${unreadCount > 0 ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                    {lastMessage || 'Chưa có tin nhắn'}
                </p>
            </div>
            {unreadCount > 0 && (
                <div className="w-5 h-5 bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center rounded-full">
                    {unreadCount}
                </div>
            )}
        </div>
    );
}