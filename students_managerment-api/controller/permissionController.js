const service = require('../service/permissionService');

const listAll = async (req, res, next) => {
    try {
        return res.status(200).json({ data: await service.listAll() });
    } catch (error) { return next(error); }
};

const listForRole = async (req, res, next) => {
    try {
        const result = await service.listForRole(req.params.role);
        if (result.kind !== 'ok') return res.status(400).json({ message: 'Vai trò không hợp lệ' });
        return res.status(200).json({ data: result });
    } catch (error) { return next(error); }
};

const updateForRole = async (req, res, next) => {
    try {
        const result = await service.updateForRole(req.params.role, req.body, req.user.id);
        const errors = {
            invalid_role: [400, 'Vai trò không hợp lệ'],
            invalid_body: [400, 'Dữ liệu gửi lên không hợp lệ'],
            invalid_fields: [400, 'Danh sách quyền không hợp lệ hoặc có trường trùng lặp'],
            unknown_permission: [400, 'Danh sách chứa quyền không tồn tại'],
            last_permission_manager: [409, 'Không thể tắt quyền quản lý phân quyền của quản trị viên cuối cùng']
        };
        if (result.kind !== 'ok') {
            const [status, message] = errors[result.kind] || [400, 'Yêu cầu không hợp lệ'];
            return res.status(status).json({ message });
        }
        return res.status(200).json({ data: { role: req.params.role, permissions: result.permissions }, message: 'Đã cập nhật phân quyền' });
    } catch (error) { return next(error); }
};

module.exports = { listAll, listForRole, updateForRole };
