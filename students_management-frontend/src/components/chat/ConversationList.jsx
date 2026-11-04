import React from 'react';
import ConversationItem from './ConversationItem';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function ConversationList({ conversations = [], activeId, onSelectConversation }) {
    const { t } = useLanguage();

    if (conversations.length === 0) {
        return (
            <div data-ui-region="conversation-list-empty" role="status" className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('noConversations')}</p>
                <p className="mt-1 max-w-[26ch] text-xs leading-5 text-slate-600 dark:text-slate-300">{t('startConversationHint')}</p>
            </div>
        );
    }

    return (
        <nav data-ui-region="conversation-list" aria-label={t('conversationListLabel')} className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
            {conversations.map((item) => (
                <ConversationItem
                    key={item.id}
                    conversation={item}
                    isSelected={item.id === activeId}
                    onClick={() => onSelectConversation(item.id)}
                />
            ))}
        </nav>
    );
}
