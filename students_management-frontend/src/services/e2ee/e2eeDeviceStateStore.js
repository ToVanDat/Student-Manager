import { openDB } from 'idb';

const openStateDb = userId => openDB(`student-manager-e2ee-device-state-${String(userId)}`, 2, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('device')) db.createObjectStore('device', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state', { keyPath: 'id' });
    }
});

export const getStoredE2EEDeviceId = async userId => {
    const db = await openStateDb(userId);
    try {
        const record = await db.get('device', 'current');
        return Number.isInteger(record?.deviceId) && record.deviceId >= 1 && record.deviceId <= 5
            ? record.deviceId
            : null;
    } finally {
        db.close();
    }
};

export const setStoredE2EEDeviceId = async (userId, deviceId) => {
    if (!Number.isInteger(deviceId) || deviceId < 1 || deviceId > 5) {
        throw new Error('Invalid E2EE device slot');
    }
    const db = await openStateDb(userId);
    try {
        await db.put('device', { id: 'current', deviceId, updatedAt: Date.now() });
    } finally {
        db.close();
    }
};

export const clearStoredE2EEDeviceId = async userId => {
    const db = await openStateDb(userId);
    try { await db.delete('device', 'current'); } finally { db.close(); }
};


export const e2eeProvisioningLocalStateStore = userId => ({
    async setItemAsync(key, value) {
        const db = await openStateDb(userId);
        try { await db.put('state', { id: String(key), value: String(value) }); } finally { db.close(); }
    },
    async deleteItemAsync(key) {
        const db = await openStateDb(userId);
        try { await db.delete('state', String(key)); } finally { db.close(); }
    }
});
