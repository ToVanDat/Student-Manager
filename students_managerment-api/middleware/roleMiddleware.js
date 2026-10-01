// uỷ quyền 
const requireRole = (role) => {
    return (req, res, next) => {

        // Chưa xác thực
        if (!req.user) {
            return res.status(401).json({
                message: 'Chưa đăng nhập'
            });
        }

        // Không đúng quyền
        if (req.user.role !== role) {
            return res.status(403).json({
                message: 'Bạn không có quyền thực hiện thao tác này'
            });
        }

        next();
    };
};

module.exports = requireRole;