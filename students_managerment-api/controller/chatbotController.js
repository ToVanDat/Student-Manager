const chatbotService = require('../service/chatbotService.js');

exports.chat = async (req, res) => {
    try {
        const result = await chatbotService.answer({
            userId: req.user.sub,
            sessionId: req.user.sessionId,
            role: req.user.role,
            message: req.body?.message
        });
        return res.json(result);
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        if (status >= 500) {
            console.error('[CHATBOT] Request failed', {
                name: error?.name,
                status,
                message: error?.message
            });
        }
        return res.status(status).json({
            message: status === 500 ? 'Trợ lý AI gặp lỗi nội bộ. Vui lòng thử lại.' : error.message
        });
    }
};


exports.clearHistory = async (req, res) => {
    try {
        await chatbotService.clearHistory({
            userId: req.user.sub,
            sessionId: req.user.sessionId
        });
        return res.json({ message: 'Đã xóa lịch sử cuộc trò chuyện hiện tại' });
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        return res.status(status).json({
            message: status === 500 ? 'Không thể xóa lịch sử trợ lý lúc này.' : error.message
        });
    }
};
