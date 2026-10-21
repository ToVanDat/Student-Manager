import React from 'react';
import { MessageSquareDashed } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function EmptyChat({ onStartConversation }) {
    const { t } = useLanguage();
    return (
        <div className="flex-1 flex min-w-0 flex-col items-center justify-center rounded-r-2xl bg-[#f4f8fd] p-8 text-center dark:bg-slate-950">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                <MessageSquareDashed size={32} />
            </div>
            <h3 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">
                {t('emptyChatTitle')}
            </h3>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
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