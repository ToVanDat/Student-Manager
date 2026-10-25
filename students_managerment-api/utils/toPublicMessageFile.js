const toPublicMessageFile = (file) => {
    if (!file) return null;
    return {
        id: file.id,
        message_id: file.message_id,
        file_name: file.file_name,
        mime_type: file.mime_type,
        file_size: file.file_size,
        created_at: file.created_at
    };
};

module.exports = toPublicMessageFile;
