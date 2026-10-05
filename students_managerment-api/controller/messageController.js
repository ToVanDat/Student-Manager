const messageService = require('../service/messageService');

/**
 * Gửi message
 */
const createMessage = async (req, res) => {
    try {
        const senderId = Number(req.user.id);
        const conversationId = Number(
            req.body.conversationId
        );
        const content = req.body.content;

        // Kiểm tra sender
        if (!Number.isInteger(senderId) || senderId <= 0) {
            return res.status(401).json({
                message: 'User hiện tại không hợp lệ'
            });
        }

        // Kiểm tra conversationId
        if (
            !Number.isInteger(conversationId) ||
            conversationId <= 0
        ) {
            return res.status(400).json({
                message: 'conversationId không hợp lệ'
            });
        }

        // Kiểm tra content
        if (
            typeof content !== 'string' ||
            !content.trim()
        ) {
            return res.status(400).json({
                message: 'Nội dung message không được để trống'
            });
        }

        const message =
            await messageService.createMessage(
                conversationId,
                senderId,
                content
            );

        return res.status(201).json({
            message: 'Gửi message thành công',
            data: message
        });

    } catch (error) {
        console.error(
            'CREATE MESSAGE ERROR:',
            error
        );

        if (
            error.message ===
            'Bạn không thuộc conversation này'
        ) {
            return res.status(403).json({
                message: error.message
            });
        }

        if (
            error.message ===
            'Nội dung message không được để trống'
        ) {
            return res.status(400).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message:
                error.message ||
                'Không thể gửi message'
        });
    }
};


/**
 * Lấy lịch sử message của conversation
 */
const getMessagesByConversation = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const conversationId = Number(
            req.params.conversationId
        );

        // Kiểm tra user
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({
                message: 'User hiện tại không hợp lệ'
            });
        }

        // Kiểm tra conversationId
        if (
            !Number.isInteger(conversationId) ||
            conversationId <= 0
        ) {
            return res.status(400).json({
                message: 'conversationId không hợp lệ'
            });
        }

        const messages =
            await messageService.getMessagesByConversation(
                conversationId,
                userId
            );

        return res.status(200).json({
            data: messages
        });

    } catch (error) {
        console.error(
            'GET CONVERSATION MESSAGES ERROR:',
            error
        );

        if (
            error.message ===
            'Bạn không thuộc conversation này'
        ) {
            return res.status(403).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message:
                error.message ||
                'Không thể lấy messages'
        });
    }
};


module.exports = {
    createMessage,
    getMessagesByConversation
};