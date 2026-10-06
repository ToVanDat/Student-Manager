import React from 'react';
import { CheckCheck, Check } from 'lucide-react';
import AvatarFallback from './AvatarFallback';

export default function MessageBubble({ message, isOwn, senderAvatar, senderName }) {
    const { content, time, isRead } = message;

    return (
        <div className={`flex items-end gap-2 mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {!isOwn && <AvatarFallback name={senderName} src={senderAvatar} size="sm" />}

            <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                isOwn
                    ? 'bg-blue-600 text-white rounded-br-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs'
            }`}>
                <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isOwn ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'}`}>
                    <span>{time}</span>
                    {isOwn && (
                        isRead
                            ? <CheckCheck size={14} className="text-blue-200" />
                            : <Check size={14} className="text-blue-300" />
                    )}
                </div>
            </div>
        </div>
    );
}
