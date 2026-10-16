const pool = require('../src/config/database');

// Explicit role guard remains separate: feature grants never elevate a standard
// user into admin-only access to student records, grades, or account controls.
const requirePermission = (permissionKey) => async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Chưa đăng nhập' });
    try {
        const { rows } = await pool.query(
            `SELECT allowed FROM role_permissions
             WHERE role = $1 AND permission_key = $2
             LIMIT 1`,
            [req.user.role, permissionKey]
        );
        if (!rows[0]?.allowed) {
            return res.status(403).json({ message: 'Bạn không có quyền truy cập chức năng này', permission: permissionKey });
        }
        return next();
    } catch (error) {
        return next(error);
    }
};

module.exports = requirePermission;
