const MAX_CIPHERTEXT_BYTES = 500 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (status, message, headers = {}) => new Response(JSON.stringify({ message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});

const corsHeaders = (request, env) => {
    const origin = request.headers.get('origin');
    const allowed = env.E2EE_FRONTEND_ORIGIN;
    if (origin && allowed && origin === allowed) {
        return {
            'access-control-allow-origin': origin,
            'access-control-allow-methods': 'PUT, GET, HEAD, DELETE, OPTIONS',
            'access-control-allow-headers': 'Authorization, Content-Type',
            'access-control-max-age': '600',
            'vary': 'Origin'
        };
    }
    return {};
};

const decodeBase64Url = value => {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
};

const verifyTicket = async (token, secret) => {
    if (typeof token !== 'string' || token.length > 4096 || !secret || secret.length < 32) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    let payload;
    try {
        payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    } catch { return null; }
    try {
        const key = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        );
        const valid = await crypto.subtle.verify('HMAC', key, decodeBase64Url(parts[1]), new TextEncoder().encode(parts[0]));
        if (!valid || payload?.v !== 1 || !['PUT', 'GET', 'HEAD', 'DELETE'].includes(payload.method) ||
            !UUID_RE.test(payload.attachmentId || '') || !UUID_RE.test(payload.objectKey || '') ||
            !Number.isSafeInteger(payload.exp) || payload.exp < Math.floor(Date.now() / 1000) ||
            !Number.isSafeInteger(payload.expectedSize) || payload.expectedSize < 1 ||
            payload.expectedSize > MAX_CIPHERTEXT_BYTES ||
            typeof payload.expectedDigest !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(payload.expectedDigest) || decodeBase64Url(payload.expectedDigest).length !== 32 ||
            !Number.isSafeInteger(payload.conversationId) || payload.conversationId < 1 ||
            !Number.isSafeInteger(payload.userId) || payload.userId < 1) return null;
        return payload;
    } catch { return null; }
};

const withCors = (response, headers) => {
    const nextHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(headers)) nextHeaders.set(key, value);
    nextHeaders.set('cache-control', 'no-store');
    nextHeaders.set('x-content-type-options', 'nosniff');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: nextHeaders });
};

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request, env);
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') {
            if (request.headers.get('origin') && !cors['access-control-allow-origin']) return json(403, 'Origin không được phép');
            return new Response(null, { status: 204, headers: cors });
        }
        if (!['PUT', 'GET', 'HEAD'].includes(request.method) || !/^\/v1\/objects\/[0-9a-f-]{36}$/i.test(url.pathname)) {
            return withCors(json(404, 'Không tìm thấy endpoint'), cors);
        }
        const attachmentId = url.pathname.split('/').at(-1);
        const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
        const ticket = await verifyTicket(token, env.E2EE_ATTACHMENT_TICKET_SECRET);
        if (!ticket || ticket.attachmentId !== attachmentId || ticket.method !== request.method) {
            return withCors(json(403, 'Ticket không hợp lệ hoặc đã hết hạn'), cors);
        }
        const key = `e2ee/${ticket.objectKey}`;

        if (request.method === 'DELETE') {
            try {
                await env.E2EE_BUCKET.delete(key);
                return withCors(new Response(null, { status: 204 }), cors);
            } catch {
                return withCors(json(502, 'Không thể xóa ciphertext'), cors);
            }
        }

        if (request.method === 'PUT') {
            const declaredLength = request.headers.get('content-length');
            if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) !== ticket.expectedSize)) {
                return withCors(json(413, 'Kích thước ciphertext không khớp ticket'), cors);
            }
            if (!request.body) return withCors(json(400, 'Thiếu ciphertext'), cors);
            let observedBytes = 0;
            const limiter = new TransformStream({
                transform(chunk, controller) {
                    observedBytes += chunk.byteLength;
                    if (observedBytes > ticket.expectedSize || observedBytes > MAX_CIPHERTEXT_BYTES) {
                        controller.error(new Error('E2EE_CIPHERTEXT_SIZE_LIMIT'));
                        return;
                    }
                    controller.enqueue(chunk);
                },
                flush(controller) {
                    if (observedBytes !== ticket.expectedSize) controller.error(new Error('E2EE_CIPHERTEXT_SIZE_MISMATCH'));
                }
            });
            try {
                const expectedDigest = decodeBase64Url(ticket.expectedDigest);
                const result = await env.E2EE_BUCKET.put(key, request.body.pipeThrough(limiter), {
                    sha256: expectedDigest.buffer.slice(expectedDigest.byteOffset, expectedDigest.byteOffset + expectedDigest.byteLength),
                    onlyIf: { etagDoesNotMatch: '*' },
                    httpMetadata: { contentType: 'application/octet-stream', cacheControl: 'private, no-store' },
                    customMetadata: { attachmentId, expectedDigest: ticket.expectedDigest }
                });
                if (!result) return withCors(json(409, 'Tệp đã được tải lên; ticket không thể ghi đè object'), cors);
                const storedDigest = result.checksums?.sha256;
                const toHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
                if (!storedDigest || toHex(new Uint8Array(storedDigest)) !== toHex(expectedDigest)) {
                    await env.E2EE_BUCKET.delete(key);
                    return withCors(json(422, 'Digest ciphertext không khớp'), cors);
                }
                return withCors(new Response(null, { status: 201, headers: { 'content-length': '0' } }), cors);
            } catch (error) {
                // Never return provider errors or object keys to clients.
                return withCors(json(400, error?.message === 'E2EE_CIPHERTEXT_SIZE_LIMIT' ||
                    error?.message === 'E2EE_CIPHERTEXT_SIZE_MISMATCH'
                    ? 'Kích thước ciphertext không hợp lệ' : 'Không thể lưu ciphertext'), cors);
            }
        }

        const object = request.method === 'HEAD'
            ? await env.E2EE_BUCKET.head(key)
            : await env.E2EE_BUCKET.get(key);
        if (!object) return withCors(json(404, 'Không tìm thấy ciphertext'), cors);
        if (object.size !== ticket.expectedSize) return withCors(json(409, 'Kích thước ciphertext không khớp'), cors);
        const storedDigest = object.checksums?.sha256;
        const storedDigestB64 = storedDigest
            ? btoa(String.fromCharCode(...new Uint8Array(storedDigest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
            : '';
        if (storedDigestB64 !== ticket.expectedDigest) return withCors(json(409, 'Digest ciphertext không khớp'), cors);
        if (request.method === 'HEAD') {
            return withCors(new Response(null, {
                status: 200,
                headers: { 'content-type': 'application/octet-stream', 'content-length': String(object.size), 'x-e2ee-sha256': storedDigestB64 }
            }), cors);
        }
        return withCors(new Response(object.body, {
            status: 200,
            headers: {
                'content-type': 'application/octet-stream',
                'content-length': String(object.size),
                'x-e2ee-sha256': storedDigestB64,
                'content-disposition': 'attachment',
                'x-content-type-options': 'nosniff'
            }
        }), cors);
    }
};
