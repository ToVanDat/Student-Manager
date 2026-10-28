const pool = require('../src/config/database');

const listPermissionsForRole = async (role) => {
    const { rows } = await pool.query(
        `SELECT p.permission_key, p.module_key, p.label_vi, p.label_en,
                p.description_vi, p.description_en, p.is_sensitive,
                COALESCE(rp.allowed, FALSE) AS allowed
         FROM permissions p
         LEFT JOIN role_permissions rp
           ON rp.permission_key = p.permission_key AND rp.role = $1
         ORDER BY p.module_key, p.permission_key`,
        [role]
    );
    return rows;
};

const listAllRolesPermissions = async () => {
    const { rows } = await pool.query(
        `SELECT p.permission_key, p.module_key, p.label_vi, p.label_en,
                p.description_vi, p.description_en, p.is_sensitive,
                COALESCE(BOOL_OR(rp.allowed) FILTER (WHERE rp.role = 'admin'), FALSE) AS admin_allowed,
                COALESCE(BOOL_OR(rp.allowed) FILTER (WHERE rp.role = 'user'), FALSE) AS user_allowed
         FROM permissions p
         LEFT JOIN role_permissions rp ON rp.permission_key = p.permission_key
         GROUP BY p.permission_key, p.module_key, p.label_vi, p.label_en,
                  p.description_vi, p.description_en, p.is_sensitive
         ORDER BY p.module_key, p.permission_key`
    );
    return rows;
};

const replaceRolePermissions = async (role, permissions, actorId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [784222]);
        const catalog = await client.query('SELECT permission_key FROM permissions');
        const known = new Set(catalog.rows.map(row => row.permission_key));
        if (permissions.some(item => !known.has(item.permission_key))) {
            await client.query('ROLLBACK');
            return { kind: 'unknown_permission' };
        }

        // This endpoint is a full replacement, not a partial patch. Reject an
        // incomplete payload rather than silently retaining stale grants that
        // the administrator believes have been removed.
        const submitted = new Set(permissions.map(item => item.permission_key));
        const missingPermissionKeys = catalog.rows
            .map(row => row.permission_key)
            .filter(permissionKey => !submitted.has(permissionKey));
        if (missingPermissionKeys.length > 0) {
            await client.query('ROLLBACK');
            return { kind: 'incomplete_permissions', missingPermissionKeys };
        }
        // Require a permission manager to remain available for at least one admin.
        if (role === 'admin' && !permissions.some(item => item.permission_key === 'permissions.manage' && item.allowed)) {
            const admins = await client.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = TRUE");
            const current = await client.query(
                "SELECT COUNT(*)::int AS count FROM role_permissions WHERE role = 'admin' AND permission_key = 'permissions.manage' AND allowed = TRUE"
            );
            if (admins.rows[0].count > 0 && current.rows[0].count <= 1) {
                await client.query('ROLLBACK');
                return { kind: 'last_permission_manager' };
            }
        }
        for (const item of permissions) {
            await client.query(
                `INSERT INTO role_permissions (role, permission_key, allowed, updated_at, updated_by)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
                 ON CONFLICT (role, permission_key) DO UPDATE
                 SET allowed = EXCLUDED.allowed, updated_at = CURRENT_TIMESTAMP, updated_by = EXCLUDED.updated_by`,
                [role, item.permission_key, item.allowed, actorId]
            );
        }
        await client.query('COMMIT');
        return { kind: 'ok', permissions: await listPermissionsForRole(role) };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { listPermissionsForRole, listAllRolesPermissions, replaceRolePermissions };
