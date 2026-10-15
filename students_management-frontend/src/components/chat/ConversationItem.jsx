import React from 'react';
import { UsersRound } from 'lucide-react';
import AvatarFallback from './AvatarFallback';

export default function ConversationItem({ conversation, isSelected, onClick }) {
    const { name, avatar, lastMessage, lastMessageAt, unreadCount, isOnline } = conversation;
    const parsedLastActivityAt = lastMessageAt ? new Date(lastMessageAt) : null;
    const time = parsedLastActivityAt && Number.isFinite(parsedLastActivityAt.getTime())
        ? parsedLastActivityAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
    const isGroup = conversation.type === 'group';

    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={isSelected ? 'true' : undefined}
            className={`group w-full flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isSelected ? 'border-[#dbeafe] dark:border-blue-900 bg-[#eaf3ff] dark:bg-blue-950/40 shadow-sm' : 'hover:border-slate-100 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800'}`}
        >
            <span className="relative shrink-0">
                {isGroup && !avatar
                    ? <span className={`flex size-12 items-center justify-center rounded-full ${isSelected ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-sky-300'}`}><UsersRound size={21} /></span>
                    : <AvatarFallback name={name} src={avatar} size="lg" showStatus={!isGroup} isOnline={isOnline} />}
                {isGroup && unreadCount > 0 && <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-white dark:border-slate-800 bg-sky-500 text-[8px] text-white"><UsersRound size={8} /></span>}
            </span>

            <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[13px] ${unreadCount > 0 ? 'font-bold text-[#172b4d] dark:text-slate-100' : 'font-semibold text-[#263852] dark:text-slate-200'}`}>{name}</span>
                    <span className={`shrink-0 text-[10px] ${unreadCount > 0 ? 'font-medium text-blue-600' : 'text-slate-400'}`}>{time}</span>
                </span>
                <span className="mt-1 flex items-center justify-between gap-2">
                    <span className={`truncate text-[11px] leading-4 ${unreadCount > 0 ? 'font-medium text-[#52627a] dark:text-slate-300' : 'text-[#8492a8] dark:text-slate-400'}`}>{lastMessage || (isGroup ? 'Nhóm mới được tạo' : 'Chưa có tin nhắn')}</span>
                    {unreadCount > 0 && <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#2563eb] px-1 text-[9px] font-bold text-white shadow-sm">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </span>
            </span>
        </button>
    );
}
