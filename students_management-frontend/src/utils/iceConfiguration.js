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
