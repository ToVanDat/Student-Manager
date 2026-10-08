const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream');

const UPLOAD_ROOT = path.resolve(
    __dirname,
    '../storage/uploads/chat'
);

const MIME_LIMITS = {
    // Images: 20 MB
    'image/jpeg': 20 * 1024 * 1024,
    'image/png': 20 * 1024 * 1024,
    'image/gif': 20 * 1024 * 1024,
    'image/webp': 20 * 1024 * 1024,

    // Videos: 500 MB
    'video/mp4': 500 * 1024 * 1024,
    'video/webm': 500 * 1024 * 1024,

    // Audio: 100 MB
    'audio/mpeg': 100 * 1024 * 1024,
    'audio/wav': 100 * 1024 * 1024,
    'audio/ogg': 100 * 1024 * 1024,
    'audio/webm': 100 * 1024 * 1024,

    // PDF and documents: 100 MB
    'application/pdf': 100 * 1024 * 1024,
    'text/plain': 100 * 1024 * 1024,

    'application/msword': 100 * 1024 * 1024,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 100 * 1024 * 1024,
    'application/vnd.ms-excel': 100 * 1024 * 1024,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 100 * 1024 * 1024,
    'application/vnd.ms-powerpoint': 100 * 1024 * 1024,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 100 * 1024 * 1024
};

const MAX_FILE_SIZE = Math.max(...Object.values(MIME_LIMITS));

class LimitTransform extends Transform {
    constructor(limit) {
        super();
        this.limit = limit;
        this.bytes = 0;
    }

    _transform(chunk, encoding, callback) {
        this.bytes += chunk.length;

        if (this.bytes > this.limit) {
            const error = new Error('FILE_SIZE_LIMIT_EXCEEDED');
            error.code = 'LIMIT_FILE_SIZE';
            return callback(error);
        }

        callback(null, chunk);
    }
}

const storage = {
    _handleFile(req, file, cb) {
        fs.mkdir(UPLOAD_ROOT, { recursive: true }, (mkdirError) => {
            if (mkdirError) {
                return cb(mkdirError);
            }

            const extension = path
                .extname(file.originalname || '')
                .toLowerCase();

            const safeExtension = /^[a-z0-9.]{1,10}$/.test(extension)
                ? extension
                : '';

            const filename = `${crypto.randomUUID()}${safeExtension}`;
            const destination = path.join(UPLOAD_ROOT, filename);
            const limiter = new LimitTransform(MIME_LIMITS[file.mimetype]);
            const output = fs.createWriteStream(destination, {
                flags: 'wx'
            });

            pipeline(file.stream, limiter, output, (error) => {
                if (error) {
                    fs.unlink(destination, () => {});
                    return cb(error);
                }

                cb(null, {
                    destination: UPLOAD_ROOT,
                    filename,
                    path: destination,
                    size: limiter.bytes
                });
            });
        });
    },

    _removeFile(req, file, cb) {
        if (!file?.path) {
            return cb(null);
        }

        fs.unlink(file.path, (error) => {
            if (error && error.code !== 'ENOENT') {
                return cb(error);
            }

            cb(null);
        });
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (!Object.prototype.hasOwnProperty.call(MIME_LIMITS, file.mimetype)) {
            return cb(new Error('Loại file không được hỗ trợ'));
        }

        cb(null, true);
    }
});

const uploadSingleFile = (req, res, next) => {
    upload.single('file')(req, res, (error) => {
        if (!error) {
            return next();
        }

        if (req.file?.path) {
            fs.unlink(req.file.path, () => {});
        }

        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                message: 'File vượt quá giới hạn cho loại MIME này'
            });
        }

        return res.status(400).json({
            message: error.message || 'Upload file không hợp lệ'
        });
    });
};

uploadSingleFile.MIME_LIMITS = MIME_LIMITS;
uploadSingleFile.UPLOAD_ROOT = UPLOAD_ROOT;

module.exports = uploadSingleFile;
