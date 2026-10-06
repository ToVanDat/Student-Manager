import React, { useState } from 'react';

export default function ConversationItem({ conversation, isSelected, onClick }) {
    const { name, avatar, lastMessage, lastMessageAt, unreadCount, isOnline } = conversation;
    const [avatarError, setAvatarError] = useState(false);

    const time = lastMessageAt
        ? new Date(lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    const initial = (name || 'U').charAt(0).toUpperCase();

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition ${isSelected ? 'bg-[#eef2ff]' : 'hover:bg-slate-50'}`}
        >
            <div className="relative flex-shrink-0">
                {!avatarError && avatar ? (
                    <img
                        src={avatar}
                        alt={name}
                        onError={() => setAvatarError(true)}
                        className="w-12 h-12 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-sm font-bold">
                        {initial}
                    </div>
                )}
                {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[14px] font-bold text-slate-800 truncate">{name}</h4>
                    <span className="text-[11px] text-slate-400 flex-shrink-0">{time}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                    <p className={`text-[12px] truncate ${unreadCount > 0 ? 'font-semibold text-slate-600' : 'text-slate-400'}`}>
                        {lastMessage || 'Chưa có tin nhắn'}
                    </p>
                    {unreadCount > 0 && (
                        <span className="flex-shrink-0 min-w-5 h-5 px-1 bg-[#4b63f5] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}
