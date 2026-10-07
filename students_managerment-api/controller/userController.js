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

module.exports = {
    searchUsersForChat
};
