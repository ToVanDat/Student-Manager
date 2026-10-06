const pool = require('../src/config/database');

const createMessageFile = async ({
    messageId,
    fileName,
    storageKey,
    mimeType,
    fileSize
}) => {
    const query = `
        INSERT INTO message_files (
            message_id,
            file_name,
            storage_key,
            mime_type,
            file_size
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            message_id,
            file_name,
            storage_key,
            mime_type,
            file_size,
            created_at;
    `;

    const { rows } = await pool.query(query, [
        messageId,
        fileName,
        storageKey,
        mimeType,
        fileSize
    ]);

    return rows[0];
};

const getMessageFileById = async (fileId) => {
    const query = `
        SELECT
            id,
            message_id,
            file_name,
            storage_key,
            mime_type,
            file_size,
            created_at
        FROM message_files
        WHERE id = $1
        LIMIT 1;
    `;

    const { rows } = await pool.query(query, [fileId]);
    return rows[0] || null;
};

const getMessageFilesByMessageId = async (messageId) => {
    const query = `
        SELECT
            id,
            message_id,
            file_name,
            storage_key,
            mime_type,
            file_size,
            created_at
        FROM message_files
        WHERE message_id = $1
        ORDER BY created_at ASC, id ASC;
    `;

    const { rows } = await pool.query(query, [messageId]);
    return rows;
};

const deleteMessageFile = async (fileId) => {
    const query = `
        DELETE FROM message_files
        WHERE id = $1
        RETURNING
            id,
            message_id,
            file_name,
            storage_key,
            mime_type,
            file_size,
            created_at;
    `;

    const { rows } = await pool.query(query, [fileId]);
    return rows[0] || null;
};

module.exports = {
    createMessageFile,
    getMessageFileById,
    getMessageFilesByMessageId,
    deleteMessageFile
};
