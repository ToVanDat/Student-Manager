const fs = require('fs/promises');
const path = require('path');

const messageFileRepository = require('../repository/messageFileRepository');
const messageRepository = require('../repository/messageRepository');
const conversationRepository = require('../repository/conversationRepository');

const UPLOAD_ROOT = path.resolve(
    __dirname,
    '../storage/uploads/chat'
);

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

    // Attachments are part of the message authored by this user. Membership
    // alone must not let another group member attach files to someone else's message.
    if (String(message.sender_id) !== String(userId)) {
        const error = new Error('Bạn chỉ có thể đính kèm file vào message do chính mình gửi');
        error.statusCode = 403;
        throw error;
    }

    const storageKey = `chat/${file.filename}`;

    try {
        const savedFile =
            await messageFileRepository.createMessageFile({
                messageId: message.id,
                fileName: String(file.originalname || 'file').replace(/[\\/\0]/g, '_').slice(0, 255),
                storageKey,
                mimeType: file.mimetype,
                fileSize: file.size
            });

        return savedFile;
    } catch (error) {
        await fs.unlink(file.path).catch(() => {});
        throw error;
    }
};

const getPhysicalPath = (storageKey) => {
    const fileName = path.basename(storageKey);
    return path.join(UPLOAD_ROOT, fileName);
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

    const filePath = getPhysicalPath(file.storage_key);

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

    const filePath = getPhysicalPath(deleted.storage_key);

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
