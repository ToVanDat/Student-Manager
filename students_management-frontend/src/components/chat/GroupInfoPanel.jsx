import React, { useEffect, useMemo, useState } from 'react';
import {
    Crown,
    Shield,
    UserPlus,
    UserMinus,
    UserRound,
    X,
    LogOut,
    ChevronDown
} from 'lucide-react';
import AvatarFallback from './AvatarFallback';

const ROLE_LABELS = {
    owner: 'Trưởng nhóm',
    admin: 'Quản trị viên',
    member: 'Thành viên'
};

const ROLE_ORDER = {
    owner: 0,
    admin: 1,
    member: 2
};

export default function GroupInfoPanel({
    open,
    conversation,
    members = [],
    currentUserId,
    searchUsers,
    searchResults = [],
    onAddMember,
    onRemoveMember,
    onUpdateRole,
    onUpdateGroupConversation,
    onlineUserIds = new Set(),
    onLeaveGroup,
    onClose
}) {
    const [memberSearch, setMemberSearch] = useState('');
    const [processingUserId, setProcessingUserId] = useState(null);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showRoleMenu, setShowRoleMenu] = useState(null);
    const [editingGroup, setEditingGroup] = useState(false);
    const [groupName, setGroupName] = useState(conversation?.name || '');
    const [savingGroup, setSavingGroup] = useState(false);

    useEffect(() => {
        if (!editingGroup) setGroupName(conversation?.name || '');
    }, [conversation?.name, editingGroup]);

    const currentMember = members.find(
        member => Number(member.user_id) === Number(currentUserId)
    );
    const currentRole = currentMember?.role || 'member';

    const canAdd = ['owner', 'admin'].includes(currentRole);

    const availableUsers = useMemo(() => {
        const memberIds = new Set(members.map(member => Number(member.user_id)));

        return searchResults.filter(user => {
            const id = Number(user.id);
            return Number.isInteger(id) && !memberIds.has(id);
        });
    }, [members, searchResults]);

    if (!open || !conversation || conversation.type !== 'group') return null;

    const handleSaveGroup = async () => {
        const name = groupName.trim();
        if (!name || !onUpdateGroupConversation || savingGroup) return;

        try {
            setSavingGroup(true);
            await onUpdateGroupConversation(name, conversation.avatar || conversation.conversationAvatar || null);
            setEditingGroup(false);
        } finally {
            setSavingGroup(false);
        }
    };

    const handleSearch = (value) => {
        setMemberSearch(value);
        if (value.trim()) {
            searchUsers?.(value.trim());
        }
    };

    const handleAdd = async (userId) => {
        try {
            setProcessingUserId(Number(userId));
            await onAddMember?.(userId);
            setMemberSearch('');
        } finally {
            setProcessingUserId(null);
        }
    };

    const handleRemove = async (userId) => {
        if (!window.confirm('Bạn có chắc muốn xoá thành viên này khỏi nhóm?')) return;

        try {
            setProcessingUserId(Number(userId));
            await onRemoveMember?.(userId);
        } finally {
            setProcessingUserId(null);
        }
    };

    const handleRole = async (userId, role) => {
        try {
            setProcessingUserId(Number(userId));
            setShowRoleMenu(null);
            await onUpdateRole?.(userId, role);
        } finally {
            setProcessingUserId(null);
        }
    };

    const handleLeave = async () => {
        if (currentRole === 'owner') return;
        if (!window.confirm('Bạn có chắc muốn rời nhóm này?')) return;

        try {
            await onLeaveGroup?.();
        } finally {
            onClose?.();
        }
    };

    const sortedMembers = [...members].sort(
        (a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3)
    );

    return (
        <div className="absolute inset-0 z-[100] flex justify-end bg-slate-950/20 backdrop-blur-[1px]">
            <div className="h-full w-[390px] max-w-[92%] overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800">
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                            Thông tin nhóm
                        </h3>
                        <p className="text-xs text-slate-400">
                            {members.length} thành viên
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label="Đóng"
                    >
                        <X size={19} />
                    </button>
                </div>

                <div className="h-[calc(100%-4rem)] overflow-y-auto">
                    <div className="flex flex-col items-center border-b border-slate-100 px-5 py-6 dark:border-slate-800">
                        <AvatarFallback
                            name={conversation.name}
                            src={conversation.avatar || conversation.conversationAvatar}
                            size="xl"
                        />
                        <h4 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">
                            {conversation.name || 'Nhóm chat'}
                        </h4>
                        {editingGroup && currentRole === 'owner' ? (
                            <div className="mt-3 flex w-full gap-2">
                                <input
                                    value={groupName}
                                    onChange={event => setGroupName(event.target.value)}
                                    maxLength={120}
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                                <button
                                    type="button"
                                    disabled={savingGroup}
                                    onClick={handleSaveGroup}
                                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                    {savingGroup ? 'Lưu...' : 'Lưu'}
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className="mt-1 text-xs text-slate-400">Group chat</p>
                                {currentRole === 'owner' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setGroupName(conversation.name || '');
                                            setEditingGroup(true);
                                        }}
                                        className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        Đổi tên nhóm
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="border-b border-slate-100 p-5 dark:border-slate-800">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    Thành viên
                                </p>
                                <p className="text-xs text-slate-400">
                                    {ROLE_LABELS[currentRole]}
                                </p>
                            </div>

                            {canAdd && (
                                <button
                                    type="button"
                                    onClick={() => setShowAddMember(value => !value)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                                >
                                    <UserPlus size={15} />
                                    Thêm
                                </button>
                            )}
                        </div>

                        {showAddMember && canAdd && (
                            <div className="mb-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                                <input
                                    value={memberSearch}
                                    onChange={event => handleSearch(event.target.value)}
                                    placeholder="Tìm username hoặc email..."
                                    autoFocus
                                    className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-0 placeholder:text-slate-400 dark:bg-slate-800 dark:text-slate-100"
                                />

                                {memberSearch.trim() && (
                                    <div className="mt-2 max-h-44 overflow-y-auto">
                                        {availableUsers.length === 0 ? (
                                            <p className="px-2 py-3 text-center text-xs text-slate-400">
                                                Không có người dùng phù hợp
                                            </p>
                                        ) : (
                                            availableUsers.map(user => (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    disabled={processingUserId === Number(user.id)}
                                                    onClick={() => handleAdd(user.id)}
                                                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                                                >
                                                    <AvatarFallback
                                                        name={user.username}
                                                        src={user.avatar_url || user.avatar}
                                                        size="sm"
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                                            {user.username}
                                                        </span>
                                                        {user.email && (
                                                            <span className="block truncate text-[11px] text-slate-400">
                                                                {user.email}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <UserPlus size={15} className="text-blue-500" />
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-1">
                            {sortedMembers.map(member => {
                                const memberId = Number(member.user_id);
                                const isMe = memberId === Number(currentUserId);
                                const isOwner = member.role === 'owner';
                                const canManageTarget =
                                    currentRole === 'owner'
                                        ? !isMe && !isOwner
                                        : currentRole === 'admin' && member.role === 'member';

                                const isProcessing = processingUserId === memberId;

                                return (
                                    <div
                                        key={memberId}
                                        className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                                    >
                                        <div className="relative">
                                            <AvatarFallback
                                                name={member.username}
                                                src={member.avatar}
                                                size="md"
                                            />
                                            {member.last_seen_at && (
                                                <span
                                                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900"
                                                    title="Đã từng hoạt động"
                                                />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                    {member.username}
                                                </p>
                                                {isMe && (
                                                    <span className="text-[10px] text-blue-500">(Bạn)</span>
                                                )}
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                                                {member.role === 'owner' ? (
                                                    <Crown size={12} className="text-amber-500" />
                                                ) : member.role === 'admin' ? (
                                                    <Shield size={12} className="text-blue-500" />
                                                ) : (
                                                    <UserRound size={12} />
                                                )}
                                                <span>{ROLE_LABELS[member.role] || ROLE_LABELS.member}</span>
                                            </div>
                                        </div>

                                        {canManageTarget && (
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    disabled={isProcessing}
                                                    onClick={() => setShowRoleMenu(
                                                        showRoleMenu === memberId ? null : memberId
                                                    )}
                                                    className="rounded-lg p-1.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                                                    title="Quản lý thành viên"
                                                >
                                                    <ChevronDown size={15} />
                                                </button>

                                                {showRoleMenu === memberId && (
                                                    <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                                        {currentRole === 'owner' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRole(memberId, member.role === 'admin' ? 'member' : 'admin')}
                                                                    className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                                                >
                                                                    {member.role === 'admin' ? 'Hạ xuống thành viên' : 'Đặt làm quản trị viên'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRole(memberId, 'owner')}
                                                                    className="w-full px-3 py-2 text-left text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                                                >
                                                                    Chuyển quyền trưởng nhóm
                                                                </button>
                                                            </>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemove(memberId)}
                                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                        >
                                                            <UserMinus size={14} />
                                                            Xoá khỏi nhóm
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-5">
                        <button
                            type="button"
                            disabled={currentRole === 'owner'}
                            onClick={handleLeave}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/50 dark:hover:bg-red-950/30"
                        >
                            <LogOut size={16} />
                            {currentRole === 'owner'
                                ? 'Chuyển quyền trước khi rời nhóm'
                                : 'Rời nhóm'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
