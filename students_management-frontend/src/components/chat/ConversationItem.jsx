import React from 'react';
import { UsersRound } from 'lucide-react';
import AvatarFallback from './AvatarFallback';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function ConversationItem({ conversation, isSelected, onClick }) {
    const { t } = useLanguage();
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
            className={`group relative flex w-full min-w-0 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-950 ${isSelected ? 'bg-blue-50/80 dark:bg-blue-950/25' : 'hover:bg-white dark:hover:bg-slate-900'}`}
        >
            {isSelected && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[#174a7e] dark:bg-blue-400" aria-hidden="true" />}
            <span className="relative shrink-0">
                {isGroup && !avatar
                    ? <span className={`flex size-12 items-center justify-center rounded-full ${isSelected ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-sky-300'}`}><UsersRound size={21} /></span>
                    : <AvatarFallback name={name} src={avatar} size="lg" showStatus={!isGroup} isOnline={isOnline} />}
                {isGroup && unreadCount > 0 && <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-sky-500 text-[8px] text-white"><UsersRound size={8} /></span>}
            </span>

            <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[13px] leading-5 ${unreadCount > 0 ? 'font-bold text-[#172b4d] dark:text-white' : 'font-semibold text-[#263852] dark:text-slate-200'}`}>{name}</span>
                    <span className={`shrink-0 text-[10px] ${unreadCount > 0 ? 'font-medium text-blue-600 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>{time}</span>
                </span>
                <span className="mt-1 flex items-center justify-between gap-2">
                    <span className={`min-w-0 truncate text-[11px] leading-4 ${unreadCount > 0 ? 'font-medium text-[#52627a] dark:text-slate-300' : 'text-[#8492a8] dark:text-slate-400'}`}>{lastMessage || (isGroup ? t('newGroupCreated') : t('noMessagesYet'))}</span>
                    {unreadCount > 0 && <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#2563eb] px-1 text-[9px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </span>
            </span>
        </button>
    );
}
