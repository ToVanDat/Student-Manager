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
        if (status >= 500) console.error('[CHATBOT] Request failed', { name: error?.name, status, message: error?.message });
        return res.status(status).json({
            message: status === 500 ? 'Trợ lý AI gặp lỗi nội bộ. Vui lòng thử lại.' : error.message
        });
    }
};

exports.chatStream = async (req, res) => {
    res.status(200);
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();
    const send = (event, data) => {
        if (!res.writableEnded) res.write('event: ' + event + String.fromCharCode(10) + 'data: ' + JSON.stringify(data) + String.fromCharCode(10, 10));
    };
    try {
        const result = await chatbotService.answer({
            userId: req.user.sub,
            sessionId: req.user.sessionId,
            role: req.user.role,
            message: req.body?.message,
            onToken: token => send('token', { token })
        });
        send('done', {
            model: result.model,
            context: result.context
        });
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        if (status >= 500) console.error('[CHATBOT][stream] Request failed', { name: error?.name, status, message: error?.message });
        send('error', {
            message: status === 500 ? 'Trợ lý AI gặp lỗi nội bộ. Vui lòng thử lại.' : error.message
        });
    } finally {
        if (!res.writableEnded) res.end();
    }
};

exports.clearHistory = async (req, res) => {
    try {
        await chatbotService.clearHistory({ userId: req.user.sub, sessionId: req.user.sessionId });
        return res.json({ message: 'Đã xóa lịch sử cuộc trò chuyện hiện tại' });
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        return res.status(status).json({
            message: status === 500 ? 'Không thể xóa lịch sử trợ lý lúc này.' : error.message
        });
    }
};
