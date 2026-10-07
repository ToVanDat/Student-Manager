const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const authorizeMessageUpload = require('../middleware/messageUploadAuthorization');
const messageFileController = require('../controller/messageFileController');

const router = express.Router();

router.post(
    '/messages/:messageId/files',
    authMiddleware,
    authorizeMessageUpload,
    upload,
    messageFileController.uploadFile
);

router.get(
    '/messages/:messageId/files',
    authMiddleware,
    messageFileController.getFilesByMessageId
);

router.get(
    '/message-files/:fileId',
    authMiddleware,
    messageFileController.downloadFile
);

router.delete(
    '/message-files/:fileId',
    authMiddleware,
    messageFileController.deleteFile
);

module.exports = router;
