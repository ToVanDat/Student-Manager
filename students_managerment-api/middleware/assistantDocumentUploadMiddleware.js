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

module.exports = uploadAssistantDocument;
