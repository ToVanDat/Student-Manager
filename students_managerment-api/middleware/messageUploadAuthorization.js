const messageRepository = require('../repository/messageRepository');
const conversationRepository = require('../repository/conversationRepository');

const authorizeMessageUpload = async (req, res, next) => {
    try {
        const messageId = Number(req.params.messageId);

        if (!Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).json({ message: 'messageId không hợp lệ' });
        }

        const message = await messageRepository.getMessageById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message không tồn tại' });
        }

        const isMember = await conversationRepository.isConversationMember(
            message.conversation_id,
            req.user.id
        );

        if (!isMember) {
            return res.status(403).json({
                message: 'Bạn không có quyền upload file vào message này'
            });
        }

        // Reject before Multer writes potentially large files to disk.
        if (String(message.sender_id) !== String(req.user.id)) {
            return res.status(403).json({
                message: 'Bạn chỉ có thể upload file vào message do chính mình gửi'
            });
        }

        next();
    } catch (error) {
        console.error('MESSAGE UPLOAD AUTHORIZATION ERROR:', error);
        return res.status(500).json({
            message: 'Không thể kiểm tra quyền upload file'
        });
    }
};

module.exports = authorizeMessageUpload;
