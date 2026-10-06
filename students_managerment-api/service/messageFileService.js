const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const messageFileRepository = require('../repository/messageFileRepository');
const messageRepository = require('../repository/messageRepository');
const conversationRepository = require('../repository/conversationRepository');

const UPLOAD_ROOT = path.resolve(
    __dirname,
    '../storage/uploads/chat'
);

const getSafeExtension = (fileName) => {
    const extension = path.extname(fileName || '').toLowerCase();

    if (!/^[a-z0-9.]{1,10}$/.test(extension)) {
        return '';
    }

    return extension;
};

const ensureUploadDirectory = async () => {
    await fs.mkdir(UPLOAD_ROOT, { recursive: true });
};

const canAccessMessage = async (messageId, userId) => {
    const message = await messageRepository.getMessageById(messageId);

    if (!message) {
        const error = new Error('Message không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    const isMember =
        await conversationRepository.isConversationMember(
            message.conversation_id,
            userId
        );

    if (!isMember) {
        const error = new Error('Bạn không có quyền truy cập message này');
        error.statusCode = 403;
        throw error;
    }

    return message;
};

const uploadFile = async (messageId, userId, file) => {
    if (!file) {
        const error = new Error('Chưa chọn file');
        error.statusCode = 400;
        throw error;
    }

    const message = await canAccessMessage(messageId, userId);

    await ensureUploadDirectory();

    const storageKey =
        `chat/${crypto.randomUUID()}${getSafeExtension(file.originalname)}`;

    const absolutePath = path.join(
        UPLOAD_ROOT,
        path.basename(storageKey)
    );

    await fs.writeFile(absolutePath, file.buffer, {
        flag: 'wx'
    });

    try {
        const savedFile =
            await messageFileRepository.createMessageFile({
                messageId: message.id,
                fileName: file.originalname,
                storageKey,
                mimeType: file.mimetype,
                fileSize: file.size
            });

        return savedFile;
    } catch (error) {
        await fs.unlink(absolutePath).catch(() => {});
        throw error;
    }
};

const getFileForDownload = async (fileId, userId) => {
    const file =
        await messageFileRepository.getMessageFileById(fileId);

    if (!file) {
        const error = new Error('File không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    await canAccessMessage(file.message_id, userId);

    const filePath = path.join(
        UPLOAD_ROOT,
        path.basename(file.storage_key)
    );

    try {
        await fs.access(filePath);
    } catch {
        const error = new Error('File vật lý không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    return {
        ...file,
        filePath
    };
};

const deleteFile = async (fileId, userId) => {
    const file =
        await messageFileRepository.getMessageFileById(fileId);

    if (!file) {
        const error = new Error('File không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    const message =
        await canAccessMessage(file.message_id, userId);

    if (String(message.sender_id) !== String(userId)) {
        const error = new Error(
            'Bạn chỉ có thể xoá file do chính mình gửi'
        );
        error.statusCode = 403;
        throw error;
    }

    const deleted =
        await messageFileRepository.deleteMessageFile(fileId);

    if (!deleted) {
        const error = new Error('File đã được xoá');
        error.statusCode = 404;
        throw error;
    }

    const filePath = path.join(
        UPLOAD_ROOT,
        path.basename(deleted.storage_key)
    );

    await fs.unlink(filePath).catch(() => {});

    return deleted;
};

const getFilesByMessageId = async (messageId, userId) => {
    await canAccessMessage(messageId, userId);
    return messageFileRepository.getMessageFilesByMessageId(messageId);
};

module.exports = {
    uploadFile,
    getFileForDownload,
    deleteFile,
    getFilesByMessageId
};
