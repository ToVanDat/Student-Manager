import client from '@/api/client';

const root = '/api/e2ee/relay';
const toBase64 = value => {
    if (!(value instanceof Uint8Array)) {
        throw new TypeError('E2EE attachment digests must be Uint8Array values');
    }
    let binary = '';
    for (let offset = 0; offset < value.length; offset += 0x8000) {
        binary += String.fromCharCode(...value.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
};
const unwrap = response => response?.data?.data;
const requireConversationId = getConversationId => {
    const value = getConversationId?.();
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) {
        const error = new Error('Select an E2EE-enabled conversation before uploading an attachment');
        error.code = 'E2EE_ATTACHMENT_CONVERSATION_REQUIRED';
        throw error;
    }
    return id;
};

/**
 * SDK SignalProtocolRemoteObjectStore adapter for the app-owned R2 broker.
 *
 * This adapter deliberately requires a conversation resolver. The app must
 * bind it to a durable upload preparation before enabling UI uploads; a global
 * "currently selected conversation" alone is not sufficient for background
 * retries after navigation. Do not enable attachment UI until that lifecycle
 * contract is supplied and browser-tested.
 */
export const createE2EER2ObjectStore = ({ getConversationId }) => ({
    async createUpload(input) {
        if (!input || typeof input.requestId !== 'string' ||
            !Number.isSafeInteger(input.preparedAt) || input.preparedAt <= 0 ||
            !Number.isSafeInteger(input.contentLength) || input.contentLength < 1 ||
            !(input.digest instanceof Uint8Array) || input.digest.length !== 32 ||
            !(input.readCapabilityDigest instanceof Uint8Array) || input.readCapabilityDigest.length !== 32) {
            const error = new Error('SDK upload preparation is missing validated retry or read-authority metadata');
            error.code = 'E2EE_ATTACHMENT_PREPARATION_INVALID';
            throw error;
        }
        const conversationId = requireConversationId(getConversationId);
        const data = unwrap(await client.post(
            `${root}/conversations/${conversationId}/attachments/upload-ticket`,
            {
                ciphertextSize: input.contentLength,
                requestId: input.requestId,
                preparedAt: input.preparedAt,
                digest: toBase64(input.digest),
                readCapabilityDigest: toBase64(input.readCapabilityDigest)
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
        if (data?.status !== 'uploaded') {
            throw new Error('E2EE attachment broker did not confirm upload completion');
        }
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
    }
});
