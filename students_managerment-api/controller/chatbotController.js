const chatbotService = require('../service/chatbotService.js');

exports.chat = async (req, res) => {
    try {
        const result = await chatbotService.answer({
            userId: req.user.sub,
            sessionId: req.user.sessionId,
            role: req.user.role,
            message: req.body?.message,
            conversationId: req.body?.conversationId || 'default',
            replaceLastTurn: req.body?.replaceLastTurn === true
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
    const clientAbortController = new AbortController();
    const abortOnDisconnect = () => {
        if (!res.writableEnded && !clientAbortController.signal.aborted) {
            clientAbortController.abort(new Error('Chat stream client disconnected'));
        }
    };
    req.once('aborted', abortOnDisconnect);
    res.once('close', abortOnDisconnect);

    res.status(200);
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();
    const send = (event, data) => {
        if (!clientAbortController.signal.aborted && !res.destroyed && !res.writableEnded) {
            res.write('event: ' + event + String.fromCharCode(10) + 'data: ' + JSON.stringify(data) + String.fromCharCode(10, 10));
        }
    };
    try {
        const result = await chatbotService.answer({
            userId: req.user.sub,
            sessionId: req.user.sessionId,
            role: req.user.role,
            message: req.body?.message,
            conversationId: req.body?.conversationId || 'default',
            replaceLastTurn: req.body?.replaceLastTurn === true,
            signal: clientAbortController.signal,
            onToken: token => send('token', { token })
        });
        send('done', {
            model: result.model,
            context: result.context
        });
    } catch (error) {
        if (!clientAbortController.signal.aborted && !res.destroyed && !res.writableEnded) {
            const status = Number.isInteger(error.status) ? error.status : 500;
            if (status >= 500) console.error('[CHATBOT][stream] Request failed', {
                name: error?.name,
                status,
                code: error?.code || null,
                message: error?.message,
                causeName: error?.cause?.name || null,
                causeMessage: error?.cause?.message || null,
                causeCode: error?.cause?.code || null,
                clientAborted: clientAbortController.signal.aborted
            });
            send('error', {
                status,
                code: error?.code || 'CHATBOT_REQUEST_FAILED',
                message: status === 500 ? 'Trợ lý AI gặp lỗi nội bộ. Vui lòng thử lại.' : error.message
            });
        }
    } finally {
        req.removeListener('aborted', abortOnDisconnect);
        res.removeListener('close', abortOnDisconnect);
        if (!res.writableEnded && !res.destroyed) res.end();
    }
};

exports.getHistory = async (req, res) => {
    try {
        const messages = await chatbotService.getHistory({ userId: req.user.sub, sessionId: req.user.sessionId, conversationId: req.query.conversationId || 'default' });
        return res.json({ messages });
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        return res.status(status).json({ message: status === 500 ? 'Không thể tải lịch sử trợ lý lúc này.' : error.message });
    }
};

exports.clearHistory = async (req, res) => {
    try {
        await chatbotService.clearHistory({ userId: req.user.sub, sessionId: req.user.sessionId, conversationId: req.body?.conversationId || req.query.conversationId || 'default' });
        return res.json({ message: 'Đã xóa lịch sử cuộc trò chuyện hiện tại' });
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        return res.status(status).json({
            message: status === 500 ? 'Không thể xóa lịch sử trợ lý lúc này.' : error.message
        });
    }
};

exports.listConversations = async (req, res) => {
    try { return res.json({ conversations: await chatbotService.listConversations({ userId: req.user.sub, sessionId: req.user.sessionId }) }); }
    catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể tải danh sách hội thoại.' }); }
};
exports.createConversation = async (req, res) => {
    try { return res.status(201).json({ conversation: await chatbotService.createConversation({ userId: req.user.sub, sessionId: req.user.sessionId, title: req.body?.title }) }); }
    catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể tạo hội thoại.' }); }
};
exports.renameConversation = async (req, res) => {
    try { return res.json({ conversation: await chatbotService.renameConversation({ userId: req.user.sub, sessionId: req.user.sessionId, conversationId: req.params.conversationId, title: req.body?.title }) }); }
    catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể đổi tên hội thoại.' }); }
};
exports.deleteConversation = async (req, res) => {
    try { await chatbotService.deleteConversation({ userId: req.user.sub, sessionId: req.user.sessionId, conversationId: req.params.conversationId }); return res.json({ success: true }); }
    catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể xóa hội thoại.' }); }
};

exports.rateAnswer = async (req, res) => {
    try {
        const result = await chatbotService.rateAnswer({
            userId: req.user.sub,
            sessionId: req.user.sessionId,
            conversationId: req.body?.conversationId || 'default',
            answerHash: req.body?.answerHash,
            rating: req.body?.rating
        });
        return res.json({ success: true, ...result });
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        return res.status(status).json({
            message: status >= 500 ? 'Không thể lưu đánh giá lúc này.' : error.message
        });
    }
};
