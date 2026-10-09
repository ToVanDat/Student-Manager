const messageFileService = require('../service/messageFileService');
const messageRepository = require('../repository/messageRepository');
const { getIO } = require('../src/socket/socket');

const handleError = (res, error) => {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error('Message file error:', error);
    }

    return res.status(statusCode).json({
        message: error.message || 'Lỗi xử lý file'
    });
};

const uploadFile = async (req, res) => {
    try {
        const messageId = Number(req.params.messageId);

        if (!Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).json({
                message: 'messageId không hợp lệ'
            });
        }

        const savedFile =
            await messageFileService.uploadFile(
                messageId,
                req.user.id,
                req.file
            );

        const message = await messageRepository.getMessageById(messageId);
        const io = getIO();

        const messageWithFile = {
            ...message,
            files: [savedFile]
        };

        io.to(`conversation:${message.conversation_id}`).emit(
            'message:file:uploaded',
            {
                messageId: message.id,
                conversationId: message.conversation_id,
                file: savedFile
            }
        );

        return res.status(201).json({
            message: 'Upload file thành công',
            file: savedFile
        });
    } catch (error) {
        return handleError(res, error);
    }
};

const getFilesByMessageId = async (req, res) => {
    try {
        const messageId = Number(req.params.messageId);

        if (!Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).json({
                message: 'messageId không hợp lệ'
            });
        }

        const files =
            await messageFileService.getFilesByMessageId(
                messageId,
                req.user.id
            );

        return res.json({ files });
    } catch (error) {
        return handleError(res, error);
    }
};

const downloadFile = async (req, res) => {
    try {
        const fileId = Number(req.params.fileId);

        if (!Number.isInteger(fileId) || fileId <= 0) {
            return res.status(400).json({
                message: 'fileId không hợp lệ'
            });
        }

        const file =
            await messageFileService.getFileForDownload(
                fileId,
                req.user.id
            );

        // Keep uploaded content as a download and prevent MIME sniffing.
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');

        const safeFallbackName = String(file.file_name || 'download')
            .replace(/[\\r\\n"\\\\]/g, '_')
            .replace(/[^\\x20-\\x7E]/g, '_')
            .slice(0, 150) || 'download';
        const encodedFileName = encodeURIComponent(
            String(file.file_name || 'download').replace(/[\\r\\n]/g, '')
        );

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${safeFallbackName}"; filename*=UTF-8''${encodedFileName}`
        );

        res.sendFile(file.filePath);
    } catch (error) {
        return handleError(res, error);
    }
};

const deleteFile = async (req, res) => {
    try {
        const fileId = Number(req.params.fileId);

        if (!Number.isInteger(fileId) || fileId <= 0) {
            return res.status(400).json({
                message: 'fileId không hợp lệ'
            });
        }

        const deleted =
            await messageFileService.deleteFile(
                fileId,
                req.user.id
            );

        const message = await messageRepository.getMessageById(deleted.message_id);
        if (message) {
            getIO().to(`conversation:${message.conversation_id}`).emit('message:file:deleted', {
                messageId: message.id,
                conversationId: message.conversation_id,
                fileId: deleted.id
            });
        }

        return res.json({
            message: 'Xoá file thành công',
            file: deleted
        });
    } catch (error) {
        return handleError(res, error);
    }
};

module.exports = {
    uploadFile,
    getFilesByMessageId,
    downloadFile,
    deleteFile
};
