import React from 'react';
import { CheckCheck, Check } from 'lucide-react';

export default function MessageBubble({ message, isOwn, senderAvatar }) {
    const { content, time, isRead } = message;

    return (
        <div className={`flex items-end gap-2 mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {/* Receiver Avatar */}
            {!isOwn && (
                <img
                    src={senderAvatar || 'https://via.placeholder.com/32'}
                    alt="avatar"
                    className="w-7 h-7 rounded-full object-cover mb-1"
                />
            )}

            {/* Bubble content */}
            <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                isOwn 
                    ? 'bg-blue-600 text-white rounded-br-xs' 
                    : 'bg-slate-100 text-slate-800 rounded-bl-xs'
            }`}>
                <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isOwn ? 'text-blue-200' : 'text-slate-400'}`}>
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