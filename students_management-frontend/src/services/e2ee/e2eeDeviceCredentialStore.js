import { openDB } from 'idb';

const openCredentialDb = userId => openDB(`student-manager-e2ee-credentials-${String(userId)}`, 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('credentials')) db.createObjectStore('credentials', { keyPath: 'deviceId' });
    }
});

export const getE2EEDeviceCredential = async (userId, deviceId) => {
    const db = await openCredentialDb(userId);
    try {
        const record = await db.get('credentials', Number(deviceId));
        return typeof record?.token === 'string' ? record.token : null;
    } finally {
        db.close();
    }
};

export const saveE2EEDeviceCredential = async (userId, deviceId, token) => {
    if (!Number.isInteger(Number(deviceId)) || Number(deviceId) < 1 || Number(deviceId) > 5 ||
        typeof token !== 'string' || token.length < 32) {
        throw new Error('Invalid E2EE device credential');
    }
    const db = await openCredentialDb(userId);
    try {
        await db.put('credentials', { deviceId: Number(deviceId), token, updatedAt: Date.now() });
    } finally {
        db.close();
    }
};

export const deleteE2EEDeviceCredential = async (userId, deviceId) => {
    const db = await openCredentialDb(userId);
    try { await db.delete('credentials', Number(deviceId)); } finally { db.close(); }
};
