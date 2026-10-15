import React from 'react';
import { MessageSquareDashed } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function EmptyChat({ onStartConversation }) {
    const { t } = useLanguage();
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-r-2xl p-8 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <MessageSquareDashed size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
                {t('emptyChatTitle')}
            </h3>
            <p className="text-sm text-slate-400 max-w-sm">
                {t('emptyChatDescription')}
            </p>
            {onStartConversation && (
                <button
                    type="button"
                    onClick={onStartConversation}
                    className="mt-5 rounded-xl bg-[#4b63f5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3f56e8]"
                >
                    {t('startChatting')}
                </button>
            )}
        </div>
    );
}