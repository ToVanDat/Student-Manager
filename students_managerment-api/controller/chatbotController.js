const chatbotService = require('../service/chatbotService.js');

exports.chat = async (req, res) => {
    try {
        const result = await chatbotService.answer({
            role: req.user.role,
            message: req.body?.message,
            history: req.body?.history
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
