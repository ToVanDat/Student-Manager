import React from 'react';
import ConversationItem from './ConversationItem';

export default function ConversationList({ conversations, activeId, onSelectConversation }) {
    if (conversations.length === 0) {
        return (
            <div className="text-center py-8 text-xs text-slate-400">
                Chưa có cuộc trò chuyện nào
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {conversations.map((item) => (
                <ConversationItem
                    key={item.id}
                    conversation={item}
                    isSelected={item.id === activeId}
                    onClick={() => onSelectConversation(item.id)}
                />
            ))}
        </div>
    );
}