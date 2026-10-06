import React, { useEffect, useRef, useState } from 'react';
import { CheckCheck, Check, MoreHorizontal, Pencil, RotateCcw, Trash2, FileText, Download } from 'lucide-react';
import AvatarFallback from './AvatarFallback';

const formatFileSize = (size) => {
    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export default function MessageBubble({
    message,
    isOwn,
    senderAvatar,
    senderName,
    onEdit,
    onRecall,
    onDeleteForMe,
    onDeleteForEveryone,
    onDownloadFile
}) {
    const { content, time, isRead } = message;
    const [menuOpen, setMenuOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editContent, setEditContent] = useState(content || '');
    const menuRef = useRef(null);

    const isRecalled = Boolean(message.is_recalled ?? message.isRecalled);
    const isDeleted = Boolean(message.deleted_at ?? message.deletedAt);
    const canEdit = isOwn && !isRecalled && !isDeleted;
    const canRecall = isOwn && !isRecalled && !isDeleted;

    useEffect(() => {
        const close = event => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const submitEdit = () => {
        const next = editContent.trim();
        if (!next || next === content) {
            setEditing(false);
            setEditContent(content || '');
            return;
        }
        onEdit?.(message.id, next);
        setEditing(false);
    };

    return (
        <div className={`flex items-end gap-2 mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {!isOwn && <AvatarFallback name={senderName} src={senderAvatar} size="sm" />}

            <div className="relative max-w-[70%]">
                <button
                    type="button"
                    onClick={() => setMenuOpen(prev => !prev)}
                    className={`absolute -top-2 ${isOwn ? '-left-9' : '-right-9'} p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800`}
                    title="Tuỳ chọn message"
                >
                    <MoreHorizontal size={17} />
                </button>

                {menuOpen && (
                    <div
                        ref={menuRef}
                        className={`absolute z-40 top-7 ${isOwn ? 'right-0' : 'left-0'} min-w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800`}
                    >
                        {canEdit && (
                            <button type="button" onClick={() => {
                                setEditing(true);
                                setMenuOpen(false);
                            }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700">
                                <Pencil size={15} /> Chỉnh sửa
                            </button>
                        )}

                        {canRecall && (
                            <button type="button" onClick={() => {
                                setMenuOpen(false);
                                onRecall?.(message.id);
                            }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700">
                                <RotateCcw size={15} /> Thu hồi
                            </button>
                        )}

                        <button type="button" onClick={() => {
                            setMenuOpen(false);
                            onDeleteForMe?.(message.id);
                        }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700">
                            <Trash2 size={15} /> Xoá ở phía tôi
                        </button>

                        {isOwn && !isRecalled && !isDeleted && (
                            <button type="button" onClick={() => {
                                setMenuOpen(false);
                                onDeleteForEveryone?.(message.id);
                            }} className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                <Trash2 size={15} /> Xoá ở mọi người
                            </button>
                        )}
                    </div>
                )}

                <div className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                    isOwn
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs'
                }`}>
                    {isDeleted ? (
                        <p className="leading-relaxed italic opacity-70">Tin nhắn đã bị xoá</p>
                    ) : isRecalled ? (
                        <p className="leading-relaxed italic opacity-70">Tin nhắn đã được thu hồi</p>
                    ) : editing ? (
                        <div className="min-w-[220px]">
                            <textarea
                                autoFocus
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Escape') {
                                        setEditing(false);
                                        setEditContent(content || '');
                                    }
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        submitEdit();
                                    }
                                }}
                                className="w-full min-h-20 resize-none rounded-lg border border-white/40 bg-white/10 px-2 py-1.5 outline-none"
                            />
                            <div className="mt-2 flex justify-end gap-2 text-xs">
                                <button type="button" onClick={() => setEditing(false)} className="px-2 py-1 rounded hover:bg-white/10">Huỷ</button>
                                <button type="button" onClick={submitEdit} className="px-2 py-1 rounded bg-white/20">Lưu</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {content && (
                                <p className="leading-relaxed whitespace-pre-wrap">
                                    {content}
                                </p>
                            )}

                            {message.files?.length > 0 && (
                                <div className={content ? 'mt-2 space-y-2' : 'space-y-2'}>
                                    {message.files.map(file => {
                                        const isImage = file.mime_type?.startsWith('image/');

                                        return (
                                            <div
                                                key={file.id}
                                                className="rounded-xl border border-white/20 bg-black/5 dark:bg-white/5 overflow-hidden"
                                            >
                                                {isImage && file.previewUrl ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDownloadFile?.(file)}
                                                        className="block w-full text-left"
                                                        title="Tải ảnh"
                                                    >
                                                        <img
                                                            src={file.previewUrl}
                                                            alt={file.file_name}
                                                            className="max-w-[280px] max-h-[280px] object-cover"
                                                        />
                                                    </button>
                                                ) : null}

                                                <div className="flex items-center gap-2 px-3 py-2">
                                                    <FileText size={18} className="shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-xs font-medium">
                                                            {file.file_name}
                                                        </p>
                                                        <p className="text-[10px] opacity-70">
                                                            {formatFileSize(file.file_size)}
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => onDownloadFile?.(file)}
                                                        className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                                                        title="Tải xuống"
                                                    >
                                                        <Download size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

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
        </div>
    );
}
