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
            className={`group w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isSelected ? 'bg-blue-50 ring-1 ring-blue-100 dark:bg-blue-950/50 dark:ring-blue-900' : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
        >
            <span className="relative shrink-0">
                {isGroup && !avatar
                    ? <span className={`flex size-12 items-center justify-center rounded-full ${isSelected ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-sky-50 text-sky-600 dark:bg-slate-700 dark:text-sky-300'}`}><UsersRound size={21} /></span>
                    : <AvatarFallback name={name} src={avatar} size="lg" showStatus={!isGroup} isOnline={isOnline} />}
                {isGroup && unreadCount > 0 && <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-[8px] text-white dark:border-slate-900"><UsersRound size={8} /></span>}
            </span>

            <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[13px] ${unreadCount > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-800 dark:text-slate-100'}`}>{name}</span>
                    <span className={`shrink-0 text-[10px] ${unreadCount > 0 ? 'font-medium text-blue-600 dark:text-blue-300' : 'text-slate-400'}`}>{time}</span>
                </span>
                <span className="mt-1 flex items-center justify-between gap-2">
                    <span className={`truncate text-[11px] leading-4 ${unreadCount > 0 ? 'font-medium text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>{lastMessage || (isGroup ? 'Nhóm mới được tạo' : 'Chưa có tin nhắn')}</span>
                    {unreadCount > 0 && <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white shadow-sm">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </span>
            </span>
        </button>
    );
}
