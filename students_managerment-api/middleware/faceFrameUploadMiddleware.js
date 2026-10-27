'use strict';

const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 2, fieldSize: 256 },
    fileFilter(req, file, callback) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            const error = new Error('Frame chỉ chấp nhận JPEG, PNG hoặc WebP');
            error.statusCode = 415;
            return callback(error);
        }
        callback(null, true);
    }
});

module.exports = (req, res, next) => {
    upload.single('frame')(req, res, error => {
        if (!error && req.file) return next();
        if (!error) return res.status(400).json({ code: 'FACE_FRAME_REQUIRED', message: 'Thiếu frame khuôn mặt.' });
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : (error.statusCode || 400);
        return res.status(status).json({
            code: error.code || 'FACE_FRAME_INVALID',
            message: error.code === 'LIMIT_FILE_SIZE' ? 'Mỗi frame không được vượt quá 5 MB' : error.message
        });
    });
};
