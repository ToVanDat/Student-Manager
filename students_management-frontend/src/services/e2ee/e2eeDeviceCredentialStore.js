import { openDB } from 'idb';

// Credentials and provisioning recovery metadata intentionally share one
// IndexedDB database so token + journal transitions can be committed atomically.
const openCredentialDb = userId => openDB(`student-manager-e2ee-credentials-${String(userId)}`, 2, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('credentials')) db.createObjectStore('credentials', { keyPath: 'deviceId' });
        if (!db.objectStoreNames.contains('provisionings')) db.createObjectStore('provisionings', { keyPath: 'sessionId' });
    }
});

const assertDeviceId = (deviceId, { linkedOnly = false } = {}) => {
    const value = Number(deviceId);
    if (!Number.isInteger(value) || value < (linkedOnly ? 2 : 1) || value > 5) {
        throw new Error('Invalid E2EE device slot');
    }
    return value;
};

const assertSessionId = sessionId => {
    if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
        throw new Error('Invalid E2EE provisioning session ID');
    }
    return sessionId;
};

const assertToken = token => {
    if (typeof token !== 'string' || token.length < 32) throw new Error('Invalid E2EE device credential');
    return token;
};

export const getE2EEDeviceCredential = async (userId, deviceId) => {
    const db = await openCredentialDb(userId);
    try {
        const record = await db.get('credentials', assertDeviceId(deviceId));
        return typeof record?.token === 'string' ? record.token : null;
    } finally {
        db.close();
    }
};

export const saveE2EEDeviceCredential = async (userId, deviceId, token) => {
    const normalizedDeviceId = assertDeviceId(deviceId);
    assertToken(token);
    const db = await openCredentialDb(userId);
    try {
        await db.put('credentials', { deviceId: normalizedDeviceId, token, updatedAt: Date.now() });
    } finally {
        db.close();
    }
};

export const deleteE2EEDeviceCredential = async (userId, deviceId) => {
    const db = await openCredentialDb(userId);
    try { await db.delete('credentials', assertDeviceId(deviceId)); } finally { db.close(); }
};

// Persist the device token and recovery journal in a single IndexedDB transaction.
// If the browser closes after the server committed completeProvisioning(), a
// subsequent adapter can still find the token without relying on the separate
// device-state database.
export const saveE2EEProvisioningRecovery = async (userId, deviceId, token, sessionId) => {
    const normalizedDeviceId = assertDeviceId(deviceId, { linkedOnly: true });
    const normalizedSessionId = assertSessionId(sessionId);
    assertToken(token);
    const db = await openCredentialDb(userId);
    try {
        const tx = db.transaction(['credentials', 'provisionings'], 'readwrite');
        const now = Date.now();
        await Promise.all([
            tx.objectStore('credentials').put({
                deviceId: normalizedDeviceId,
                token,
                provisioningSessionId: normalizedSessionId,
                pendingProvisioningRollbackSessionId: null,
                updatedAt: now
            }),
            tx.objectStore('provisionings').put({
                sessionId: normalizedSessionId,
                deviceId: normalizedDeviceId,
                phase: 'awaiting_local_commit',
                rollbackPending: false,
                createdAt: now,
                updatedAt: now
            })
        ]);
        await tx.done;
    } finally {
        db.close();
    }
};

export const getE2EEProvisioningRecoveryRecords = async userId => {
    const db = await openCredentialDb(userId);
    try {
        return await db.getAll('provisionings');
    } finally {
        db.close();
    }
};

export const markE2EEProvisioningPhase = async (userId, sessionId, phase) => {
    const normalizedSessionId = assertSessionId(sessionId);
    const allowed = new Set(['awaiting_local_commit', 'awaiting_ack', 'completed', 'rollback_pending']);
    if (!allowed.has(phase)) throw new Error('Invalid E2EE provisioning recovery phase');
    const db = await openCredentialDb(userId);
    try {
        const tx = db.transaction(['credentials', 'provisionings'], 'readwrite');
        const journal = await tx.objectStore('provisionings').get(normalizedSessionId);
        if (!journal) {
            await tx.done;
            return false;
        }
        const now = Date.now();
        await tx.objectStore('provisionings').put({
            ...journal,
            phase,
            rollbackPending: phase === 'rollback_pending',
            updatedAt: now
        });
        const credential = await tx.objectStore('credentials').get(journal.deviceId);
        if (credential) {
            await tx.objectStore('credentials').put({
                ...credential,
                pendingProvisioningRollbackSessionId: phase === 'rollback_pending' ? normalizedSessionId : null,
                updatedAt: now
            });
        }
        await tx.done;
        return true;
    } finally {
        db.close();
    }
};

export const setPendingE2EEProvisioningRollback = async (userId, deviceId, sessionId) => {
    const normalizedDeviceId = assertDeviceId(deviceId, { linkedOnly: true });
    const normalizedSessionId = assertSessionId(sessionId);
    const db = await openCredentialDb(userId);
    try {
        const tx = db.transaction(['credentials', 'provisionings'], 'readwrite');
        const credentialStore = tx.objectStore('credentials');
        const journalStore = tx.objectStore('provisionings');
        const record = await credentialStore.get(normalizedDeviceId);
        if (typeof record?.token !== 'string' || record.token.length < 32) {
            throw new Error('Cannot queue provisioning rollback without the device credential');
        }
        const journal = await journalStore.get(normalizedSessionId);
        const now = Date.now();
        await Promise.all([
            credentialStore.put({
                ...record,
                pendingProvisioningRollbackSessionId: normalizedSessionId,
                updatedAt: now
            }),
            journalStore.put({
                ...(journal || {}),
                sessionId: normalizedSessionId,
                deviceId: normalizedDeviceId,
                phase: 'rollback_pending',
                rollbackPending: true,
                updatedAt: now
            })
        ]);
        await tx.done;
    } finally {
        db.close();
    }
};

export const getPendingE2EEProvisioningRollback = async (userId, deviceId) => {
    const db = await openCredentialDb(userId);
    try {
        const record = await db.get('credentials', assertDeviceId(deviceId));
        return typeof record?.pendingProvisioningRollbackSessionId === 'string'
            ? record.pendingProvisioningRollbackSessionId
            : null;
    } finally {
        db.close();
    }
};

// Remove token and journal atomically, but only after the server has confirmed
// rollback/finalization. This is deliberately not used on ambiguous HTTP errors.
export const finalizeE2EEProvisioningRecovery = async (userId, deviceId, sessionId) => {
    const normalizedDeviceId = assertDeviceId(deviceId, { linkedOnly: true });
    const normalizedSessionId = assertSessionId(sessionId);
    const db = await openCredentialDb(userId);
    try {
        const tx = db.transaction(['credentials', 'provisionings'], 'readwrite');
        const journal = await tx.objectStore('provisionings').get(normalizedSessionId);
        if (journal && Number(journal.deviceId) === normalizedDeviceId) {
            await tx.objectStore('provisionings').delete(normalizedSessionId);
        }
        const credential = await tx.objectStore('credentials').get(normalizedDeviceId);
        if (credential?.provisioningSessionId === normalizedSessionId ||
            credential?.pendingProvisioningRollbackSessionId === normalizedSessionId) {
            await tx.objectStore('credentials').delete(normalizedDeviceId);
        }
        await tx.done;
    } finally {
        db.close();
    }
};


// Successful ACK is the only transition that retires the recovery journal
// while preserving the credential for normal relay authentication.
export const completeE2EEProvisioningRecovery = async (userId, deviceId, sessionId) => {
    const normalizedDeviceId = assertDeviceId(deviceId, { linkedOnly: true });
    const normalizedSessionId = assertSessionId(sessionId);
    const db = await openCredentialDb(userId);
    try {
        const tx = db.transaction(['credentials', 'provisionings'], 'readwrite');
        const journal = await tx.objectStore('provisionings').get(normalizedSessionId);
        if (journal && Number(journal.deviceId) === normalizedDeviceId) {
            await tx.objectStore('provisionings').delete(normalizedSessionId);
        }
        const credentialStore = tx.objectStore('credentials');
        const credential = await credentialStore.get(normalizedDeviceId);
        if (credential?.provisioningSessionId === normalizedSessionId) {
            const next = { ...credential, updatedAt: Date.now() };
            delete next.provisioningSessionId;
            delete next.pendingProvisioningRollbackSessionId;
            await credentialStore.put(next);
        }
        await tx.done;
    } finally {
        db.close();
    }
};


export const saveE2EEProvisioningOwnerRecovery = async (userId, sessionId) => {
    const normalizedSessionId = assertSessionId(sessionId);
    const db = await openCredentialDb(userId);
    try {
        await db.put('provisionings', {
            sessionId: normalizedSessionId,
            kind: 'owner',
            phase: 'awaiting_complete',
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    } finally {
        db.close();
    }
};

export const finalizeE2EEProvisioningOwnerRecovery = async (userId, sessionId) => {
    const normalizedSessionId = assertSessionId(sessionId);
    const db = await openCredentialDb(userId);
    try {
        const tx = db.transaction('provisionings', 'readwrite');
        const store = tx.objectStore('provisionings');
        const record = await store.get(normalizedSessionId);
        if (record?.kind === 'owner') await store.delete(normalizedSessionId);
        await tx.done;
    } finally {
        db.close();
    }
};
