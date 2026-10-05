import React from 'react';
import { MessageSquareDashed } from 'lucide-react';

export default function EmptyChat() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-r-2xl p-8 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <MessageSquareDashed size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
                Chưa chọn cuộc trò chuyện nào
            </h3>
            <p className="text-xs text-slate-400 max-w-xs">
                Hãy chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu trao đổi tin nhắn.
            </p>
        </div>
    );
}