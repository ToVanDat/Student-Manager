const repository = require('../repository/permissionRepository');

const ROLES = new Set(['admin', 'user']);

const listAll = () => repository.listAllRolesPermissions();

const listForRole = (role) => {
    if (!ROLES.has(role)) return Promise.resolve({ kind: 'invalid_role' });
    return repository.listPermissionsForRole(role).then(permissions => ({ kind: 'ok', role, permissions }));
};

const updateForRole = async (role, payload, actorId) => {
    if (!ROLES.has(role)) return { kind: 'invalid_role' };
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { kind: 'invalid_body' };
    if (Object.keys(payload).some(key => key !== 'permissions') || !Array.isArray(payload.permissions)) return { kind: 'invalid_fields' };
    const seen = new Set();
    for (const item of payload.permissions) {
        if (!item || typeof item !== 'object' || Array.isArray(item) ||
            Object.keys(item).some(key => !['permission_key', 'allowed'].includes(key)) ||
            typeof item.permission_key !== 'string' || !item.permission_key.trim() ||
            typeof item.allowed !== 'boolean' || seen.has(item.permission_key)) {
            return { kind: 'invalid_fields' };
        }
        seen.add(item.permission_key);
    }
    return repository.replaceRolePermissions(role, payload.permissions, Number(actorId));
};

module.exports = { listAll, listForRole, updateForRole };
