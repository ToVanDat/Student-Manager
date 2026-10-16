const userService = require('../service/userService');

const searchUsersForChat = async (req, res, next) => {
    try {
        const currentUserId = Number(req.user.id);

        if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
            return res.status(401).json({
                message: 'User hiện tại không hợp lệ'
            });
        }

        const users = await userService.searchUsersForChat(
            currentUserId,
            req.query.search
        );

        return res.status(200).json({
            data: users
        });
    } catch (error) {
        next(error);
    }
};

const listUsersForAdmin = async (req, res, next) => {
    try {
        const users = await userService.listUsersForAdmin(req.query.search);
        return res.status(200).json({ data: users });
    } catch (error) {
        next(error);
    }
};

const updateUserAccess = async (req, res, next) => {
    try {
        const result = await userService.updateUserAccess(req.params.id, req.body, req.user.id);
        const responses = {
            invalid_id: [400, 'ID tài khoản không hợp lệ'],
            invalid_body: [400, 'Dữ liệu gửi lên không hợp lệ'],
            invalid_fields: [400, 'Role phải là admin/user và is_active phải là boolean'],
            not_found: [404, 'Không tìm thấy tài khoản'],
            self_change: [409, 'Không thể tự thay đổi quyền hoặc trạng thái tài khoản đang đăng nhập'],
            last_admin: [409, 'Không thể vô hiệu hóa hoặc hạ quyền quản trị viên cuối cùng']
        };
        if (result.kind !== 'ok') {
            const [status, message] = responses[result.kind] || [400, 'Yêu cầu không hợp lệ'];
            return res.status(status).json({ message });
        }
        return res.status(200).json({ data: result.user, message: 'Đã cập nhật quyền tài khoản' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listUsersForAdmin,
    updateUserAccess,
    searchUsersForChat
};
