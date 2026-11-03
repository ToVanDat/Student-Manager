const isIceUri = (value) => {
    if (typeof value !== 'string' || value.length > 512 || /\s/.test(value)) return false;
    const match = value.match(/^(?:stun|stuns|turn|turns):(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::(\d{1,5}))?(?:\?transport=(?:udp|tcp))?$/i);
    if (!match) return false;
    return !match[1] || (Number(match[1]) >= 1 && Number(match[1]) <= 65535);
};

const normalizeUrls = (urls) => {
    const values = Array.isArray(urls) ? urls : [urls];
    return [...new Set(values.filter(isIceUri))];
};

/**
 * Normalize the authenticated backend ICE response before passing it to the
 * browser. TURN credentials are accepted only for TURN URLs and are never
 * copied into diagnostics or logs.
 */
export function buildIceConfiguration(response, fallbackStunUri = '') {
    const iceServers = [];
    const seen = new Set();

    const addServer = (server) => {
        if (!server || typeof server !== 'object') return;
        const urls = normalizeUrls(server.urls);
        if (!urls.length) return;

        const hasTurnUrl = urls.some((url) => /^(?:turn|turns):/i.test(url));
        if (hasTurnUrl && (
            typeof server.username !== 'string' ||
            !server.username ||
            typeof server.credential !== 'string' ||
            !server.credential
        )) return;

        const normalized = hasTurnUrl
            ? { urls, username: server.username, credential: server.credential }
            : { urls };
        const key = JSON.stringify(normalized);
        if (seen.has(key)) return;
        seen.add(key);
        iceServers.push(normalized);
    };

    if (Array.isArray(response?.iceServers)) {
        response.iceServers.forEach(addServer);
    }

    if (fallbackStunUri) addServer({ urls: fallbackStunUri });

    const turnAvailable = iceServers.some((server) =>
        (Array.isArray(server.urls) ? server.urls : [server.urls])
            .some((url) => /^(?:turn|turns):/i.test(url)) &&
        Boolean(server.username && server.credential)
    );

    return {
        iceServers,
        turnAvailable,
        credentialExpiresAt: Number.isFinite(response?.credentialExpiresAt)
            ? response.credentialExpiresAt
            : null
    };
}

/** Return a bounded refresh delay that leaves time to rotate short-lived TURN credentials. */
export function getIceCredentialRefreshDelay(expiresAt, nowMs = Date.now()) {
    if (!Number.isFinite(expiresAt)) return null;
    const remainingMs = Math.max(0, expiresAt * 1000 - nowMs);
    const safetyMarginMs = Math.min(120_000, Math.max(15_000, Math.floor(remainingMs * 0.1)));
    return Math.max(1_000, remainingMs - safetyMarginMs);
}

/** Extract ICE username fragments from all media sections in an SDP. */
export function extractIceUfrags(sdp = '') {
    if (typeof sdp !== 'string' || !sdp) return [];
    return [...new Set([...sdp.matchAll(/^a=ice-ufrag:([^\r\n]+)/gm)]
        .map(match => match[1].trim())
        .filter(Boolean))];
}

/** Candidates from an earlier ICE restart must not be applied to a newer SDP. */
export function isIceCandidateForRemoteDescription(candidate, remoteSdp = '') {
    const usernameFragment = candidate?.usernameFragment;
    if (!usernameFragment) return true;
    const activeUfrags = extractIceUfrags(remoteSdp);
    return activeUfrags.length === 0 || activeUfrags.includes(usernameFragment);
}
