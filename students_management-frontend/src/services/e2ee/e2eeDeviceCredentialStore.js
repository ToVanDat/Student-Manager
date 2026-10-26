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


export const setPendingE2EEProvisioningRollback = async (userId, deviceId, sessionId) => {
    if (!Number.isInteger(Number(deviceId)) || Number(deviceId) < 2 || Number(deviceId) > 5 ||
        typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
        throw new Error('Invalid E2EE provisioning rollback marker');
    }
    const db = await openCredentialDb(userId);
    try {
        const record = await db.get('credentials', Number(deviceId));
        if (typeof record?.token !== 'string' || record.token.length < 32) {
            throw new Error('Cannot queue provisioning rollback without the device credential');
        }
        await db.put('credentials', {
            ...record,
            pendingProvisioningRollbackSessionId: sessionId,
            updatedAt: Date.now()
        });
    } finally {
        db.close();
    }
};

export const getPendingE2EEProvisioningRollback = async (userId, deviceId) => {
    const db = await openCredentialDb(userId);
    try {
        const record = await db.get('credentials', Number(deviceId));
        return typeof record?.pendingProvisioningRollbackSessionId === 'string'
            ? record.pendingProvisioningRollbackSessionId
            : null;
    } finally {
        db.close();
    }
};
