import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import worker from '../src/index.js';

const secret = 'test-worker-ticket-secret-at-least-32-bytes';
const attachmentId = 'a3b7f38d-1c5a-4d89-9c13-2a8b3f0c1d22';
const objectKey = 'b3b7f38d-1c5a-4d89-9c13-2a8b3f0c1d22';
const bytes = new TextEncoder().encode('ciphertext fixture');
const digest = crypto.createHash('sha256').update(bytes).digest('base64url');
const hex = value => Buffer.from(value).toString('hex');

const ticket = (method, overrides = {}) => {
    const payload = {
        v: 1, method, attachmentId, objectKey, conversationId: 7, userId: 12,
        expectedSize: bytes.length, expectedDigest: digest,
        exp: Math.floor(Date.now() / 1000) + 60,
        ...overrides
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
};
const createBucket = () => {
    const objects = new Map();
    return {
        objects,
        async put(key, stream, options = {}) {
            if (options.onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null;
            const chunks = [];
            const reader = stream.getReader();
            while (true) {
                const next = await reader.read();
                if (next.done) break;
                chunks.push(Buffer.from(next.value));
            }
            const value = Buffer.concat(chunks);
            const actual = crypto.createHash('sha256').update(value).digest();
            const expected = Buffer.from(options.sha256);
            if (!actual.equals(expected)) throw new Error('checksum mismatch');
            const checksum = actual.buffer.slice(actual.byteOffset, actual.byteOffset + actual.byteLength);
            const object = {
                size: value.length,
                checksums: { sha256: checksum },
                customMetadata: options.customMetadata,
                body: new ReadableStream({ start(controller) { controller.enqueue(value); controller.close(); } })
            };
            objects.set(key, { ...object, value });
            return object;
        },
        async head(key) {
            const object = objects.get(key);
            if (!object) return null;
            return { size: object.size, checksums: object.checksums, customMetadata: object.customMetadata };
        },
        async get(key) {
            const object = objects.get(key);
            if (!object) return null;
            return {
                size: object.size,
                checksums: object.checksums,
                customMetadata: object.customMetadata,
                body: new ReadableStream({ start(controller) { controller.enqueue(object.value); controller.close(); } })
            };
        },
        async delete(key) { objects.delete(key); }
    };
};
const request = (method, token, body) => new Request(`https://worker.test/v1/objects/${attachmentId}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/octet-stream' } : {}) },
    ...(body ? { body } : {})
});
const env = bucket => ({ E2EE_BUCKET: bucket, E2EE_ATTACHMENT_TICKET_SECRET: secret, E2EE_FRONTEND_ORIGIN: 'https://app.example.test' });

test('Worker accepts a digest-verified ciphertext upload and exposes a verified HEAD receipt', async () => {
    const bucket = createBucket();
    const upload = await worker.fetch(request('PUT', ticket('PUT'), bytes), env(bucket));
    assert.equal(upload.status, 201);
    const head = await worker.fetch(request('HEAD', ticket('HEAD')), env(bucket));
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(bytes.length));
    assert.equal(head.headers.get('x-e2ee-sha256'), digest);
    const download = await worker.fetch(request('GET', ticket('GET')), env(bucket));
    assert.equal(download.status, 200);
    assert.equal(hex(new Uint8Array(await download.arrayBuffer())), hex(bytes));
});

test('Worker refuses a changed ciphertext digest and never overwrites an accepted object', async () => {
    const bucket = createBucket();
    const wrongDigest = crypto.createHash('sha256').update('different bytes').digest('base64url');
    const bad = await worker.fetch(request('PUT', ticket('PUT', { expectedDigest: wrongDigest }), bytes), env(bucket));
    assert.equal(bad.status, 400);
    assert.equal(bucket.objects.size, 0);

    const first = await worker.fetch(request('PUT', ticket('PUT'), bytes), env(bucket));
    assert.equal(first.status, 201);
    const second = await worker.fetch(request('PUT', ticket('PUT'), bytes), env(bucket));
    assert.equal(second.status, 409);
    assert.equal(bucket.objects.size, 1);
});

test('Worker rejects tampered/expired tickets and deletes only with a method-bound ticket', async () => {
    const bucket = createBucket();
    const invalid = await worker.fetch(request('GET', 'not-a-ticket'), env(bucket));
    assert.equal(invalid.status, 403);
    const expired = await worker.fetch(request('GET', ticket('GET', { exp: 1 })), env(bucket));
    assert.equal(expired.status, 403);

    const uploaded = await worker.fetch(request('PUT', ticket('PUT'), bytes), env(bucket));
    assert.equal(uploaded.status, 201);
    const methodMismatch = await worker.fetch(request('DELETE', ticket('GET')), env(bucket));
    assert.equal(methodMismatch.status, 403);
    const deleted = await worker.fetch(request('DELETE', ticket('DELETE')), env(bucket));
    assert.equal(deleted.status, 204);
    assert.equal(bucket.objects.size, 0);
});

test('Worker rejects ciphertext whose streamed byte count differs from the immutable ticket', async () => {
    const bucket = createBucket();
    const mismatch = await worker.fetch(
        request('PUT', ticket('PUT', { expectedSize: bytes.length + 1 }), bytes),
        env(bucket)
    );
    assert.equal(mismatch.status, 400);
    assert.equal(bucket.objects.size, 0);

    const overrun = await worker.fetch(
        request('PUT', ticket('PUT'), new Uint8Array(bytes.length + 1)),
        env(bucket)
    );
    assert.equal(overrun.status, 400);
    assert.equal(bucket.objects.size, 0);
});

test('Worker enforces the configured frontend origin for browser preflight requests', async () => {
    const bucket = createBucket();
    const allowed = await worker.fetch(new Request('https://worker.test/v1/objects/' + attachmentId, {
        method: 'OPTIONS',
        headers: { Origin: 'https://app.example.test', 'Access-Control-Request-Method': 'PUT' }
    }), env(bucket));
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example.test');
    assert.match(allowed.headers.get('access-control-allow-methods') || '', /PUT/);

    const denied = await worker.fetch(new Request('https://worker.test/v1/objects/' + attachmentId, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'PUT' }
    }), env(bucket));
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('Worker rejects method/path mismatches and does not expose object bytes without a valid ticket', async () => {
    const bucket = createBucket();
    const wrongPath = await worker.fetch(new Request('https://worker.test/v1/objects/not-a-uuid', {
        method: 'GET', headers: { Authorization: `Bearer ${ticket('GET')}` }
    }), env(bucket));
    assert.equal(wrongPath.status, 404);

    const wrongAttachment = await worker.fetch(
        request('GET', ticket('GET', { attachmentId: 'c3b7f38d-1c5a-4d89-9c13-2a8b3f0c1d22' })),
        env(bucket)
    );
    assert.equal(wrongAttachment.status, 403);
    assert.equal(bucket.objects.size, 0);
});



test('Worker returns 404 for root and invalid object paths without touching R2', async () => {
    const bucket = createBucket();
    const root = await worker.fetch(new Request('https://worker.test/'), env(bucket));
    assert.equal(root.status, 404);
    const malformed = await worker.fetch(new Request('https://worker.test/v1/objects/not-a-uuid'), env(bucket));
    assert.equal(malformed.status, 404);
    assert.equal(bucket.objects.size, 0);
});

test('Worker returns a sanitized 502 when R2 read operations throw', async () => {
    const bucket = {
        async head() { throw new Error('internal bucket credentials or object key'); },
        async get() { throw new Error('internal bucket credentials or object key'); },
        async put() { throw new Error('unused'); },
        async delete() { throw new Error('unused'); }
    };
    const response = await worker.fetch(request('GET', ticket('GET')), env(bucket));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { message: 'Không thể truy cập ciphertext' });
});
