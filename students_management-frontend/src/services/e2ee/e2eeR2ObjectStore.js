import client from '@/api/client';

const root = '/api/e2ee/relay';
const DB_NAME = 'student-manager-e2ee-attachment-jobs';
const STORE_NAME = 'conversationBindings';

const toBase64 = value => {
    if (!(value instanceof Uint8Array)) throw new TypeError('E2EE attachment digests must be Uint8Array values');
    let binary = '';
    for (let offset = 0; offset < value.length; offset += 0x8000) {
        binary += String.fromCharCode(...value.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
};
const fromBase64 = value => {
    if (typeof value !== 'string') throw new TypeError('Expected a Base64 digest');
    const binary = atob(value);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
};
const unwrap = response => response?.data?.data;
const requireConversationId = getConversationId => {
    const id = Number(getConversationId?.());
    if (!Number.isSafeInteger(id) || id < 1) {
        const error = new Error('Select an E2EE-enabled conversation before uploading an attachment');
        error.code = 'E2EE_ATTACHMENT_CONVERSATION_REQUIRED';
        throw error;
    }
    return id;
};
const requireUploadIdentity = input => {
    if (!input || typeof input.requestId !== 'string' ||
        !/^media-upload\/[A-Za-z0-9_-]{24}$/.test(input.requestId) ||
        !Number.isSafeInteger(input.preparedAt) || input.preparedAt <= 0 ||
        !Number.isSafeInteger(input.contentLength) || input.contentLength < 1 ||
        input.contentLength > 500 * 1024 * 1024 ||
        !(input.digest instanceof Uint8Array) || input.digest.length !== 32 ||
        !(input.readCapabilityDigest instanceof Uint8Array) || input.readCapabilityDigest.length !== 32) {
        const error = new Error('SDK upload preparation is missing validated retry identity, digest, or read authority');
        error.code = 'E2EE_ATTACHMENT_PREPARATION_INVALID';
        throw error;
    }
};

const openJobDb = () => new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
        reject(new Error('IndexedDB is required for durable E2EE attachment retry context'));
        return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Cannot open E2EE attachment job store'));
});
const bindingKey = (requestId, preparedAt) => `${requestId}:${preparedAt}`;
const readConversationBinding = async (requestId, preparedAt) => {
    const db = await openJobDb();
    try {
        return await new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
                .get(bindingKey(requestId, preparedAt));
            request.onsuccess = () => resolve(request.result?.conversationId ?? null);
            request.onerror = () => reject(request.error || new Error('Cannot read attachment retry context'));
        });
    } finally { db.close(); }
};
const saveConversationBinding = async (requestId, preparedAt, conversationId) => {
    const db = await openJobDb();
    try {
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).put({
                key: bindingKey(requestId, preparedAt),
                requestId,
                preparedAt,
                conversationId,
                createdAt: Date.now()
            });
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('Cannot persist attachment retry context'));
            transaction.onabort = () => reject(transaction.error || new Error('Attachment retry context write aborted'));
        });
    } finally { db.close(); }
};
const removeConversationBinding = async (requestId, preparedAt) => {
    const db = await openJobDb();
    try {
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).delete(bindingKey(requestId, preparedAt));
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('Cannot remove attachment retry context'));
        });
    } finally { db.close(); }
};

/**
 * SDK SignalProtocolRemoteObjectStore adapter backed by the app's authenticated
 * API and private R2 Worker. Conversation identity is persisted before creating
 * the remote reservation, so retries after navigation resolve to the same chat.
 */
export const createE2EER2ObjectStore = ({ getConversationId }) => ({
    async createUpload(input) {
        requireUploadIdentity(input);
        const digest = toBase64(input.digest);
        const readCapabilityDigest = toBase64(input.readCapabilityDigest);
        let conversationId = await readConversationBinding(input.requestId, input.preparedAt);

        if (conversationId == null) {
            const resolved = unwrap(await client.post(`${root}/attachments/uploads/resolve`, {
                requestId: input.requestId,
                preparedAt: input.preparedAt,
                contentLength: input.contentLength,
                digest,
                readCapabilityDigest
            }));
            if (resolved?.conversationId) conversationId = Number(resolved.conversationId);
        }

        if (conversationId == null) {
            conversationId = requireConversationId(getConversationId);
            // Persist before network reservation. If the response is lost, retry
            // will still resolve to this conversation, not whichever chat is open.
            await saveConversationBinding(input.requestId, input.preparedAt, conversationId);
        }

        const data = unwrap(await client.post(
            `${root}/conversations/${conversationId}/attachments/upload-ticket`,
            {
                ciphertextSize: input.contentLength,
                requestId: input.requestId,
                preparedAt: input.preparedAt,
                digest,
                readCapabilityDigest
            }
        ));
        if (!data?.attachmentId || !data?.uploadUrl || !data?.uploadToken || !data?.expiresAt) {
            throw new Error('E2EE attachment broker returned an incomplete upload reservation');
        }
        return {
            objectId: data.objectId || data.attachmentId,
            uploadUrl: data.uploadUrl,
            expiresAt: new Date(data.expiresAt).getTime(),
            headers: data.headers || {
                Authorization: `Bearer ${data.uploadToken}`,
                'Content-Type': 'application/octet-stream'
            },
            protocol: 'put'
        };
    },

    async completeUpload({ objectId }) {
        if (typeof objectId !== 'string' || !objectId) throw new TypeError('objectId is required');
        const data = unwrap(await client.post(
            `${root}/attachments/${encodeURIComponent(objectId)}/complete`
        ));
        if (data?.status !== 'uploaded') throw new Error('Broker did not confirm attachment upload completion');
    },

    async reconcileUpload({ objectId }) {
        if (typeof objectId !== 'string' || !objectId) throw new TypeError('objectId is required');
        const data = unwrap(await client.post(
            `${root}/attachments/${encodeURIComponent(objectId)}/reconcile`
        ));
        if (data == null) return null;
        if (data.objectId !== objectId || !Number.isSafeInteger(Number(data.contentLength)) ||
            Number(data.contentLength) < 1 || typeof data.digest !== 'string') {
            throw new Error('Broker returned an invalid upload receipt');
        }
        return { objectId, contentLength: Number(data.contentLength), digest: fromBase64(data.digest) };
    },

    async abandonUpload({ requestId, preparedAt }) {
        if (typeof requestId !== 'string' || !Number.isSafeInteger(preparedAt)) {
            throw new TypeError('requestId and preparedAt are required');
        }
        await client.post(`${root}/attachments/uploads/abandon`, { requestId, preparedAt });
        await removeConversationBinding(requestId, preparedAt);
    },

    async createDownload({ objectId, readCapability }) {
        if (typeof objectId !== 'string' || !objectId || typeof readCapability !== 'string' || !readCapability) {
            const error = new Error('E2EE attachment pointer is missing its object ID or read authority');
            error.code = 'E2EE_ATTACHMENT_POINTER_INVALID';
            throw error;
        }
        const data = unwrap(await client.post(
            `${root}/attachments/${encodeURIComponent(objectId)}/download-ticket`,
            { readCapability }
        ));
        if (!data?.downloadUrl || !data?.downloadToken || !data?.expiresInSeconds) {
            throw new Error('E2EE attachment broker returned an incomplete download reservation');
        }
        return {
            downloadUrl: data.downloadUrl,
            expiresAt: Date.now() + Number(data.expiresInSeconds) * 1000,
            headers: { Authorization: `Bearer ${data.downloadToken}` }
        };
    },

    async deleteObject({ objectId }) {
        if (typeof objectId !== 'string' || !objectId) throw new TypeError('objectId is required');
        await client.delete(`${root}/attachments/${encodeURIComponent(objectId)}`);
    }
});
