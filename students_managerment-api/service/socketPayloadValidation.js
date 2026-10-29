const normalizeSocketPayload = (payload) =>
    payload !== null && typeof payload === 'object' && !Array.isArray(payload)
        ? payload
        : {};

const normalizeSocketEventArgs = (...eventArgs) => {
    if (typeof eventArgs[0] === 'function') return [{}, ...eventArgs];
    const [payload, ...remainingArgs] = eventArgs;
    return [normalizeSocketPayload(payload), ...remainingArgs];
};

const wrapSocketEventListener = (listener, onError) => function (...eventArgs) {
    try {
        const result = listener.apply(this, normalizeSocketEventArgs(...eventArgs));
        if (result && typeof result.then === 'function') {
            return result.catch((error) => {
                if (typeof onError !== 'function') throw error;
                onError(error, this);
            });
        }
        return result;
    } catch (error) {
        if (typeof onError !== 'function') throw error;
        onError(error, this);
        return undefined;
    }
};

const MAX_SESSION_DESCRIPTION_BYTES = 64 * 1024;
const MAX_ICE_CANDIDATE_BYTES = 4 * 1024;
const MAX_SDP_MID_LENGTH = 256;

const isPlainObject = (value) =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);

const isValidSessionDescription = (description, expectedType) => {
    if (!isPlainObject(description) || !['offer', 'answer'].includes(expectedType)) {
        return false;
    }

    if (description.type !== expectedType || typeof description.sdp !== 'string') {
        return false;
    }

    const sdpBytes = Buffer.byteLength(description.sdp, 'utf8');
    return sdpBytes > 0 && sdpBytes <= MAX_SESSION_DESCRIPTION_BYTES;
};

const isValidIceCandidate = (candidate) => {
    if (!isPlainObject(candidate) || typeof candidate.candidate !== 'string') {
        return false;
    }

    if (Buffer.byteLength(candidate.candidate, 'utf8') > MAX_ICE_CANDIDATE_BYTES) {
        return false;
    }

    if (
        candidate.sdpMid !== undefined &&
        candidate.sdpMid !== null &&
        (typeof candidate.sdpMid !== 'string' || candidate.sdpMid.length > MAX_SDP_MID_LENGTH)
    ) {
        return false;
    }

    if (
        candidate.sdpMLineIndex !== undefined &&
        candidate.sdpMLineIndex !== null &&
        (!Number.isSafeInteger(candidate.sdpMLineIndex) || candidate.sdpMLineIndex < 0)
    ) {
        return false;
    }

    if (
        candidate.usernameFragment !== undefined &&
        candidate.usernameFragment !== null &&
        (typeof candidate.usernameFragment !== 'string' || candidate.usernameFragment.length > MAX_SDP_MID_LENGTH)
    ) {
        return false;
    }

    return true;
};

module.exports = {
    normalizeSocketPayload,
    normalizeSocketEventArgs,
    wrapSocketEventListener,
    MAX_SESSION_DESCRIPTION_BYTES,
    MAX_ICE_CANDIDATE_BYTES,
    isValidSessionDescription,
    isValidIceCandidate
};
