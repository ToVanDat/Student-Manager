const isGroupManager = (role) => role === 'owner' || role === 'admin';

const canRemoveMember = (actorRole, targetRole) => {
    if (!isGroupManager(actorRole)) return false;
    if (targetRole === null || targetRole === undefined || targetRole === 'owner') return false;
    if (actorRole === 'admin' && targetRole !== 'member') return false;
    return true;
};

const canChangeMemberRole = (actorRole, targetRole, actorId, targetUserId, nextRole) => {
    if (actorRole !== 'owner') return false;
    if (!['owner', 'admin', 'member'].includes(nextRole)) return false;
    if (targetRole === null || targetRole === undefined) return false;
    if (Number(actorId) === Number(targetUserId) && nextRole !== 'owner') return false;
    return true;
};

module.exports = { isGroupManager, canRemoveMember, canChangeMemberRole };
