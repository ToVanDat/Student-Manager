import React, { useEffect, useRef, useState } from 'react';
import { CheckCheck, Check, MoreHorizontal, Pencil, RotateCcw, Trash2, FileText, Download, Reply } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
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
    onDownloadFile,
    onDeleteFile,
    onReply,
    onToggleReaction,
    currentUserId
}) {
    const { content, time, isRead } = message;
    const status = message.status;
    const uploadProgress = Number(message.uploadProgress ?? message.files?.[0]?.uploadProgress ?? 0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editContent, setEditContent] = useState(content || '');
    const [hovered, setHovered] = useState(false);
    const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
    const hoverCloseTimer = useRef(null);

    const keepHovered = () => {
        if (hoverCloseTimer.current) {
            clearTimeout(hoverCloseTimer.current);
            hoverCloseTimer.current = null;
        }
        setHovered(true);
    };

    const scheduleHoverClose = () => {
        if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
        hoverCloseTimer.current = setTimeout(() => {
            if (!reactionPickerOpen && !menuOpen) {
                setHovered(false);
            }
        }, 180);
    };

    const isRecalled = Boolean(message.is_recalled ?? message.isRecalled);
    const isDeleted = Boolean(message.deleted_at ?? message.deletedAt);
    const canEdit = isOwn && !isRecalled && !isDeleted;
    const canRecall = isOwn && !isRecalled && !isDeleted;

    useEffect(() => {
        const close = event => {
            if (!event.target.closest?.('[data-message-menu]')) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
        };
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

    const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥'];

    const groupedReactions = Object.entries(
        (Array.isArray(message.reactions) ? message.reactions : []).reduce((groups, reaction) => {
            if (!groups[reaction.emoji]) groups[reaction.emoji] = [];
            groups[reaction.emoji].push(reaction);
            return groups;
        }, {})
    );

    // System messages are lifecycle/status messages for a group.
    // They must not behave like normal user messages (no hover actions/reactions).
    if (message.message_type === 'system' || message.messageType === 'system') {
        return (
            <div className="flex justify-center px-4 py-1.5" role="status">
                <div className="max-w-[85%] rounded-full bg-slate-100 px-3.5 py-1.5 text-center text-[11px] font-medium text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                    {message.content}
                    {time && (
                        <span className="ml-2 font-normal opacity-70">{time}</span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            data-message-id={message.id}
            className={`relative flex items-start gap-2 mb-5 ${isOwn ? 'justify-end' : 'justify-start'}`}
        >
            {!isOwn && <AvatarFallback name={senderName} src={senderAvatar} size="sm" />}

            <div
                className={`relative max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                onMouseEnter={keepHovered}
                onMouseLeave={scheduleHoverClose}
            >
                <div className={`relative rounded-[18px] px-4 py-2.5 text-sm shadow-sm transition-shadow ${
                    isOwn
                        ? 'bg-blue-600 text-white rounded-br-[5px]'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-[5px]'
                }`}>
                    {hovered && !isDeleted && !isRecalled && (
                        <button
                            type="button"
                            data-message-menu
                            onMouseEnter={keepHovered}
                            onClick={() => {
                                keepHovered();
                                setMenuOpen(prev => !prev);
                                setReactionPickerOpen(false);
                            }}
                            className={`absolute right-1.5 top-1.5 z-[60] flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/10 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white ${isOwn ? 'text-white/70 hover:text-white' : ''}`}
                            title="Tuỳ chọn"
                            aria-label="Tuỳ chọn tin nhắn"
                        >
                            <MoreHorizontal size={17} />
                        </button>
                    )}

                    {message.reply_to && !isDeleted && !isRecalled && (
                        <div
                            className={`mb-2 w-full max-w-[280px] overflow-hidden rounded-xl border-l-[3px] px-3 py-2 ${
                                isOwn
                                    ? 'border-blue-200/90 bg-blue-500/25 text-blue-50'
                                    : 'border-blue-500 bg-slate-200/80 text-slate-700 dark:bg-slate-700/80 dark:text-slate-200'
                            }`}
                            title={message.reply_to.content || 'Tin nhắn có tệp'}
                        >
                            <p className={`mb-0.5 text-[11px] font-semibold leading-4 ${
                                isOwn
                                    ? 'text-white'
                                    : 'text-blue-600 dark:text-blue-400'
                            }`}>
                                Tin nhắn được trả lời
                            </p>
                            <p className="truncate text-xs leading-5 opacity-90">
                                {message.reply_to.content || '📎 Tin nhắn có tệp đính kèm'}
                            </p>
                        </div>
                    )}

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
                                            <div key={file.id} className="rounded-xl border border-white/20 bg-black/5 dark:bg-white/5 overflow-hidden">
                                                {isImage && file.previewUrl ? (
                                                    <button type="button" onClick={() => onDownloadFile?.(file)} className="block w-full text-left" title="Tải ảnh">
                                                        <img src={file.previewUrl} alt={file.file_name} className="max-w-[280px] max-h-[280px] object-cover" />
                                                    </button>
                                                ) : null}

                                                {file.mime_type?.startsWith('audio/') && file.downloadUrl ? (
                                                    <div className="px-3 pt-3">
                                                        <audio controls preload="metadata" className="w-full max-w-[280px]" src={file.downloadUrl} />
                                                    </div>
                                                ) : null}

                                                <div className="flex items-center gap-2 px-3 py-2">
                                                    <FileText size={18} className="shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-xs font-medium">{file.file_name}</p>
                                                        <p className="text-[10px] opacity-70">{formatFileSize(file.file_size)}</p>
                                                    </div>
                                                    <button type="button" onClick={() => onDownloadFile?.(file)} className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10" title="Tải xuống">
                                                        <Download size={15} />
                                                    </button>
                                                    {isOwn && (
                                                        <button type="button" onClick={() => onDeleteFile?.(file)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" title="Xoá file">
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        isOwn ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                        <span>{time}</span>
                        {isOwn && (
                            status === 'failed'
                                ? <span className="text-red-400 font-medium">Gửi thất bại</span>
                                : status === 'uploading' || status === 'processing'
                                    ? <span className="text-blue-200">{status === 'processing' ? 'Đang xử lý' : `Đang tải ${uploadProgress}%`}</span>
                                    : status === 'sending'
                                        ? <span className="text-blue-200">Đang gửi...</span>
                                        : isRead
                                            ? <CheckCheck size={14} className="text-blue-200" />
                                            : <Check size={14} className="text-blue-300" />
                        )}
                    </div>
                </div>

                {menuOpen && (
                    <div
                        data-message-menu
                        onMouseEnter={keepHovered}
                        onMouseLeave={scheduleHoverClose}
                        className={`absolute top-full z-[80] mt-1 min-w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${isOwn ? 'right-0' : 'left-0'}`}
                    >
                        <button type="button" onClick={() => {
                            setMenuOpen(false);
                            onReply?.(message);
                        }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700">
                            <Reply size={15} /> <span>Trả lời</span>
                        </button>

                        {canEdit && (
                            <button type="button" onClick={() => {
                                setEditing(true);
                                setMenuOpen(false);
                            }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700">
                                <Pencil size={15} /> <span>Chỉnh sửa</span>
                            </button>
                        )}

                        {canRecall && (
                            <button type="button" onClick={() => {
                                setMenuOpen(false);
                                onRecall?.(message.id);
                            }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700">
                                <RotateCcw size={15} /> <span>Thu hồi</span>
                            </button>
                        )}

                        <button type="button" onClick={() => {
                            setMenuOpen(false);
                            onDeleteForMe?.(message.id);
                        }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700">
                            <Trash2 size={15} /> <span>Xoá ở phía tôi</span>
                        </button>

                        {isOwn && !isRecalled && !isDeleted && (
                            <button type="button" onClick={() => {
                                setMenuOpen(false);
                                onDeleteForEveryone?.(message.id);
                            }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                <Trash2 size={15} /> <span>Xoá ở mọi người</span>
                            </button>
                        )}
                    </div>
                )}

                {!isOwn && hovered && !isDeleted && !isRecalled && (
                    <div
                        className="relative z-50 mt-2 self-start"
                        onMouseEnter={keepHovered}
                        onMouseLeave={scheduleHoverClose}
                    >
                        <div className="relative">
                            <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white/98 px-1.5 py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800/98">
                                {quickReactions.slice(0, 4).map(emoji => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => {
                                            onToggleReaction?.(message.id, emoji);
                                            setReactionPickerOpen(false);
                                            setHovered(false);
                                        }}
                                        className="flex h-7 w-7 items-center justify-center rounded-full text-[17px] leading-none transition-transform hover:scale-125 hover:bg-slate-100 dark:hover:bg-slate-700"
                                        title={`Thả ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}

                                <button
                                    type="button"
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={() => {
                                        setReactionPickerOpen(prev => !prev);
                                        setMenuOpen(false);
                                        keepHovered();
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-base font-medium text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                    title="Thêm reaction"
                                    aria-label="Thêm reaction"
                                >
                                    +
                                </button>
                            </div>

                            {reactionPickerOpen && (
                                <div
                                    className="absolute left-0 top-full z-[70] pt-2"
                                    onMouseEnter={keepHovered}
                                    onMouseLeave={scheduleHoverClose}
                                    onMouseDown={event => event.stopPropagation()}
                                >
                                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
                                        <EmojiPicker
                                            onEmojiClick={(emojiData) => {
                                                onToggleReaction?.(message.id, emojiData.emoji);
                                                setReactionPickerOpen(false);
                                                setHovered(false);
                                            }}
                                            width={330}
                                            height={380}
                                            lazyLoadEmojis
                                            previewConfig={{ showPreview: false }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {groupedReactions.length > 0 && (
                    <div
                        className={`relative z-30 mt-1 flex items-center rounded-full border border-slate-200 bg-white/98 px-1 py-0.5 shadow-md dark:border-slate-700 dark:bg-slate-800/98 ${isOwn ? 'self-end' : 'self-start'}`}
                    >
                        {groupedReactions.map(([emoji, reactions]) => {
                            const mine = reactions.some(r => Number(r.user_id) === Number(currentUserId));
                            return (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => onToggleReaction?.(message.id, emoji)}
                                    className={`relative flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm transition hover:scale-110 ${
                                        mine
                                            ? 'bg-blue-50 ring-1 ring-blue-400 dark:bg-blue-950/50'
                                            : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                    title={`${reactions.length} người thả ${emoji}`}
                                >
                                    <span>{emoji}</span>
                                    {reactions.length > 1 && (
                                        <span className="ml-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-300">
                                            {reactions.length}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
