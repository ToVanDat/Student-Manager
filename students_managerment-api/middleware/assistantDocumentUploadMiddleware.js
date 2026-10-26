const multer = require('multer');
const aiConfig = require('../src/config/ai.js');

const uploadAssistantDocument = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: aiConfig.rag.maxUploadBytes,
        files: 1,
        fields: 4,
        parts: 5
    },
    fileFilter(req, file, callback) {
        const extensionOk = typeof file.originalname === 'string' && /\.txt$/i.test(file.originalname);
        const mimeOk = file.mimetype === 'text/plain' || file.mimetype === 'application/octet-stream';
        if (!extensionOk || !mimeOk) {
            const error = new Error('Giai đoạn này chỉ hỗ trợ tệp .txt');
            error.status = 415;
            return callback(error);
        }
        callback(null, true);
    }
}).single('document');

module.exports = (req, res, next) => {
    uploadAssistantDocument(req, res, error => {
        if (!error) return next();
        const status = Number.isInteger(error.status) ? error.status : (error instanceof multer.MulterError ? 400 : 415);
        return res.status(status).json({ message: status === 413 ? 'Tệp vượt quá giới hạn 1 MB' : error.message || 'Tệp tải lên không hợp lệ' });
    });
};
