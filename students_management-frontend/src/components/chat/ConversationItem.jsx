import React from 'react';

export default function ConversationItem({ conversation, isSelected, onClick }) {
    const { name, avatar, lastMessage, time, unreadCount, isOnline } = conversation;

    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                isSelected 
                    ? 'bg-blue-50/80 border border-blue-100' 
                    : 'hover:bg-slate-50'
            }`}
        >
            {/* Avatar + Online Dot */}
            <div className="relative flex-shrink-0">
                <img
                    src={avatar || 'https://via.placeholder.com/40'}
                    alt={name}
                    className="w-11 h-11 rounded-full object-cover"
                />
                {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                )}
            </div>

            {/* Information */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                    <h4 className={`text-sm truncate ${isSelected ? 'font-bold text-blue-900' : 'font-semibold text-slate-800'}`}>
                        {name}
                    </h4>
                    <span className="text-xs text-slate-400 font-medium ml-2">{time}</span>
                </div>
                <p className={`text-xs truncate ${unreadCount > 0 ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                    {lastMessage}
                </p>
            </div>

            {/* Unread Badge */}
            {unreadCount > 0 && (
                <div className="w-5 h-5 bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center rounded-full flex-shrink-0">
                    {unreadCount}
                </div>
            )}
        </div>
    );
}