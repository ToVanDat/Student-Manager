import { openDB } from 'idb';

const DB_VERSION = 1;
const DB_PREFIX = 'student-manager-e2ee-history-user-';

const openHistoryDb = (userId) => openDB(`${DB_PREFIX}${String(userId)}`, DB_VERSION, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('messages')) {
            const messages = db.createObjectStore('messages', { keyPath: 'id' });
            messages.createIndex('conversationId', 'conversationId');
            messages.createIndex('conversationTimestamp', ['conversationId', 'createdAt']);
        }
        if (!db.objectStoreNames.contains('keys')) {
            db.createObjectStore('keys', { keyPath: 'id' });
        }
    }
});

const getHistoryKey = async (db, createIfMissing = false) => {
    const record = await db.get('keys', 'history-key');
    if (record?.key) return record.key;

    const messageCount = await db.count('messages');
    if (messageCount > 0) {
        const error = new Error('E2EE local history key is missing; refusing to replace it and lose decryptability.');
        error.code = 'E2EE_HISTORY_KEY_MISSING';
        throw error;
    }
    if (!createIfMissing) return null;

    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    await db.put('keys', { id: 'history-key', key });
    return key;
};

export const saveE2EEHistoryMessage = async (userId, message) => {
    if (!userId || !message?.id || !message?.conversation_id) return;
    const db = await openHistoryDb(userId);
    try {
        const key = await getHistoryKey(db, true);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const serialized = new TextEncoder().encode(JSON.stringify(message));
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, serialized);
        await db.put('messages', {
            id: String(message.id),
            conversationId: String(message.conversation_id),
            createdAt: String(message.created_at || new Date().toISOString()),
            iv,
            ciphertext
        });
    } finally {
        db.close();
    }
};

export const loadE2EEHistory = async (userId, conversationId) => {
    if (!userId || !conversationId) return [];
    const db = await openHistoryDb(userId);
    try {
        const rows = await db.getAllFromIndex('messages', 'conversationTimestamp', IDBKeyRange.bound(
            [String(conversationId), ''],
            [String(conversationId), '\\uffff']
        ));
        if (!rows.length) return [];
        const key = await getHistoryKey(db, false);
        if (!key) {
            const error = new Error('E2EE local history key is unavailable.');
            error.code = 'E2EE_HISTORY_KEY_MISSING';
            throw error;
        }
        const messages = [];
        for (const row of rows) {
            try {
                const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv }, key, row.ciphertext);
                messages.push(JSON.parse(new TextDecoder().decode(plaintext)));
            } catch {
                const error = new Error('E2EE local history could not be decrypted.');
                error.code = 'E2EE_HISTORY_DECRYPT_FAILED';
                throw error;
            }
        }
        return messages;
    } finally {
        db.close();
    }
};

export const deleteE2EEHistoryMessage = async (userId, messageId) => {
    if (!userId || !messageId) return;
    const db = await openHistoryDb(userId);
    try { await db.delete('messages', String(messageId)); } finally { db.close(); }
};
