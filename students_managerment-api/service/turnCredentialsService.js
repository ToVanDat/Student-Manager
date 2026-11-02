'use strict';

const crypto = require('node:crypto');

function configurationError(message) {
    const error = new Error(message);
    error.code = 'TURN_CONFIG_INVALID';
    return error;
}

function parseServerUrls(value, protocols, label) {
    const entries = String(value || '')
        .split(/[;,\\n]/)
        .map(item => item.trim())
        .filter(Boolean);

    for (const uri of entries) {
        const match = uri.match(/^(stun|stuns|turn|turns):(\\[[0-9a-f:.]+\\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::(\\d{1,5}))?(?:\\?transport=(udp|tcp))?$/i);
        const protocol = match ? match[1].toLowerCase() + ':' : '';
        const port = match?.[3] ? Number(match[3]) : null;
        if (!match || !protocols.includes(protocol) || (port !== null && (port < 1 || port > 65535)) || uri.length > 512) {
            throw configurationError(label + ' chứa URI không hợp lệ.');
        }
    }

    return [...new Set(entries)];
}

function createIceConfiguration(userId, env = process.env, nowMs = Date.now()) {
    const normalizedUserId = String(userId ?? '');
    if (!/^[1-9]\d{0,18}$/.test(normalizedUserId)) {
        throw configurationError('Không thể tạo TURN credential cho tài khoản không hợp lệ.');
    }

    const stunUrls = parseServerUrls(env.STUN_URIS, ['stun:', 'stuns:'], 'STUN_URIS');
    const turnUrls = parseServerUrls(env.TURN_URIS, ['turn:', 'turns:'], 'TURN_URIS');
    const secret = String(env.TURN_SHARED_SECRET || '');

    if (turnUrls.length && !secret) {
        throw configurationError('TURN_SHARED_SECRET chưa được cấu hình.');
    }
    if (secret && !turnUrls.length) {
        throw configurationError('TURN_URIS chưa được cấu hình.');
    }
    if (turnUrls.length && Buffer.byteLength(secret, 'utf8') < 32) {
        throw configurationError('TURN_SHARED_SECRET phải có tối thiểu 32 byte.');
    }

    const ttlRaw = env.TURN_CREDENTIAL_TTL_SECONDS;
    const ttlSeconds = ttlRaw == null || ttlRaw === ''
        ? 86400
        : Number(ttlRaw);
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86400) {
        throw configurationError('TURN_CREDENTIAL_TTL_SECONDS phải nằm trong khoảng 60–86400 giây.');
    }

    const iceServers = stunUrls.map(urls => ({ urls }));
    let expiresAt = null;

    if (turnUrls.length) {
        expiresAt = Math.floor(nowMs / 1000) + ttlSeconds;
        const username = expiresAt + ':' + normalizedUserId;
        const credential = crypto
            .createHmac('sha1', secret)
            .update(username, 'utf8')
            .digest('base64');

        iceServers.push({
            urls: turnUrls,
            username,
            credential
        });
    }

    return {
        iceServers,
        turnAvailable: turnUrls.length > 0,
        credentialExpiresAt: expiresAt,
        credentialTtlSeconds: turnUrls.length ? ttlSeconds : null
    };
}

module.exports = {
    createIceConfiguration,
    parseServerUrls
};
