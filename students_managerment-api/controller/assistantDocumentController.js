const ragService = require('../service/ragService.js');
const { extractTextDocument } = require('../service/documentTextExtractor.js');

exports.uploadTextDocument = async (req, res) => {
    try {
        if (!req.file?.buffer) return res.status(400).json({ message: 'Vui lòng chọn tệp .txt' });
        const extracted = extractTextDocument({
            buffer: req.file.buffer,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype
        });
        const document = await ragService.ingestTextDocument({
            title: req.body?.title || extracted.sourceName.replace(/\.txt$/i, ''),
            sourceName: extracted.sourceName,
            text: extracted.text,
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
