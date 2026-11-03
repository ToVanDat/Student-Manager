const multer = require('multer');
const path = require('path');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024,
        files: 1,
        fields: 0,
        parts: 1
    },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        const allowedMimeTypes = new Set([
            'text/csv',
            'application/vnd.ms-excel',
            'text/plain',
            'application/octet-stream'
        ]);
        if (extension !== '.csv' || !allowedMimeTypes.has(file.mimetype)) {
            const error = new Error('Chỉ chấp nhận tệp .csv hợp lệ.');
            error.code = 'STUDENT_CSV_INVALID_FILE';
            return callback(error);
        }
        return callback(null, true);
    }
});

const uploadStudentCsv = (req, res, next) => {
    upload.single('file')(req, res, error => {
        if (!error) {
            if (!req.file?.buffer) {
                return res.status(400).json({ message: 'Vui lòng chọn tệp CSV.' });
            }
            return next();
        }

        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'Tệp CSV không được vượt quá 1 MB.' });
        }
        return res.status(400).json({ message: error.message || 'Tệp CSV không hợp lệ.' });
    });
};

module.exports = uploadStudentCsv;
