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

const hasSignature = (mimeType, bytes) => {
    const startsWith = (...values) =>
        values.every((value, index) => bytes[index] === value);
    const containsAscii = (value, offset = 0) =>
        Buffer.from(value, 'ascii').every((byte, index) => bytes[offset + index] === byte);

    switch (mimeType) {
        case 'image/jpeg':
            return startsWith(0xff, 0xd8, 0xff);
        case 'image/png':
            return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
        case 'image/gif':
            return containsAscii('GIF87a') || containsAscii('GIF89a');
        case 'image/webp':
            return containsAscii('RIFF') && containsAscii('WEBP', 8);
        case 'application/pdf':
            return containsAscii('%PDF-');
        case 'video/mp4':
            return containsAscii('ftyp', 4);
        case 'video/webm':
        case 'audio/webm':
            return startsWith(0x1a, 0x45, 0xdf, 0xa3);
        case 'audio/ogg':
            return containsAscii('OggS');
        case 'audio/wav':
            return containsAscii('RIFF') && containsAscii('WAVE', 8);
        case 'audio/mpeg':
            return containsAscii('ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
        case 'application/msword':
        case 'application/vnd.ms-excel':
        case 'application/vnd.ms-powerpoint':
            return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            return startsWith(0x50, 0x4b, 0x03, 0x04);
        case 'text/plain':
            return !bytes.includes(0x00);
        default:
            return false;
    }
};

const validateFileContent = async (file) => {
    const handle = await fs.open(file.path, 'r');
    try {
        const buffer = Buffer.alloc(16);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        const header = buffer.subarray(0, bytesRead);
        if (!hasSignature(file.mimetype, header)) {
            const error = new Error('Nội dung file không khớp với loại file đã khai báo');
            error.statusCode = 415;
            throw error;
        }
    } finally {
        await handle.close();
    }
};

const uploadFile = async (messageId, userId, file) => {
    if (!file) {
        const error = new Error('Chưa chọn file');
        error.statusCode = 400;
        throw error;
    }

    try {
        const message = await canAccessMessage(messageId, userId);

        // Attachments are part of the message authored by this user. Membership
        // alone must not let another group member attach files to someone else's message.
        if (String(message.sender_id) !== String(userId)) {
            const error = new Error('Bạn chỉ có thể đính kèm file vào message do chính mình gửi');
            error.statusCode = 403;
            throw error;
        }

        // MIME supplied by the browser is untrusted. Verify the file signature
        // before storing metadata or allowing other members to download it.
        await validateFileContent(file);

        const storageKey = `chat/${file.filename}`;
        return await messageFileRepository.createMessageFile({
            messageId: message.id,
            fileName: String(file.originalname || 'file').replace(/[\\/\0]/g, '_').slice(0, 255),
            storageKey,
            mimeType: file.mimetype,
            fileSize: file.size
        });
    } catch (error) {
        // Multer writes the file before authorization; remove it for every failure.
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

    const filePath = getPhysicalPath(file.storage_key);
    const quarantinePath = `${filePath}.deleting-${require('crypto').randomUUID()}`;
    let quarantined = false;

    // Move the file out of its live path first. If the filesystem refuses,
    // keep the DB row so the operation can be retried instead of orphaning it.
    try {
        await fs.rename(filePath, quarantinePath);
        quarantined = true;
    } catch (error) {
        if (error.code !== 'ENOENT') {
            error.statusCode = 500;
            throw error;
        }
        // The file is already missing; remove the stale metadata below.
    }

    let deleted;
    try {
        deleted = await messageFileRepository.deleteMessageFile(fileId);
        if (!deleted) {
            const error = new Error('File đã được xoá');
            error.statusCode = 404;
            throw error;
        }
    } catch (error) {
        if (quarantined) {
            await fs.rename(quarantinePath, filePath).catch((restoreError) => {
                console.error('MESSAGE FILE RESTORE ERROR:', restoreError.message);
            });
        }
        throw error;
    }

    if (quarantined) {
        await fs.unlink(quarantinePath).catch((error) => {
            // Metadata is already deleted; leave an identifiable quarantine
            // file for a storage cleanup job instead of hiding the failure.
            console.error('MESSAGE FILE QUARANTINE CLEANUP ERROR:', {
                fileId,
                path: quarantinePath,
                error: error.message
            });
        });
    }

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
