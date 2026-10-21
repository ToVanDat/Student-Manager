const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter(req, file, callback) {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            const error = new Error('Avatar chỉ chấp nhận JPEG, PNG hoặc WebP');
            error.statusCode = 415;
            return callback(error);
        }
        callback(null, true);
    }
});

module.exports = (req, res, next) => {
    upload.single('avatar')(req, res, error => {
        if (!error) return next();
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : (error.statusCode || 400);
        return res.status(status).json({
            message: error.code === 'LIMIT_FILE_SIZE'
                ? 'Avatar không được vượt quá 5 MB'
                : (error.message || 'Avatar không hợp lệ')
        });
    });
};
