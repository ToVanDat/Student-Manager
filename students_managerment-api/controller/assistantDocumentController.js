const path = require('path');
const ragService = require('../service/ragService.js');

exports.uploadTextDocument = async (req, res) => {
    try {
        if (!req.file?.buffer) return res.status(400).json({ message: 'Vui lòng chọn tệp .txt' });
        const decoded = req.file.buffer.toString('utf8');
        if (decoded.includes('\u0000') || decoded.includes('\uFFFD')) {
            return res.status(400).json({ message: 'Tệp không phải văn bản UTF-8 hợp lệ' });
        }
        const document = await ragService.ingestTextDocument({
            title: req.body?.title || path.basename(req.file.originalname, path.extname(req.file.originalname)),
            sourceName: path.basename(req.file.originalname).slice(0, 255),
            text: decoded,
            visibility: req.body?.visibility || 'all',
            createdBy: req.user.id
        });
        return res.status(201).json({ document });
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        if (status >= 500) console.error('[RAG] Document ingestion failed', { name: error?.name, message: error?.message });
        return res.status(status).json({
            message: status >= 500 ? 'Không thể xử lý tài liệu. Kiểm tra cấu hình Ollama và pgvector.' : error.message
        });
    }
};

exports.listDocuments = async (req, res) => {
    try {
        const documents = await ragService.listDocuments();
        return res.json({ documents });
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 503;
        return res.status(status).json({ message: 'Không thể tải danh sách tài liệu RAG. Kiểm tra migration schema.' });
    }
};
