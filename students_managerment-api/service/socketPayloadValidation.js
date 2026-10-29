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


const installSocketEventValidation = (socket, onError, reservedEvents = []) => {
    const originalOn = socket.on.bind(socket);
    const originalRemoveListener = socket.removeListener.bind(socket);
    const reserved = new Set(reservedEvents);
    const wrappedListeners = new Map();

    const getWrappedListener = (eventName, listener) => {
        if (typeof listener !== 'function' || reserved.has(eventName)) return listener;
        return wrappedListeners.get(eventName)?.get(listener) || listener;
    };

    socket.on = function (eventName, listener) {
        if (typeof listener !== 'function' || reserved.has(eventName)) {
            originalOn(eventName, listener);
            return this;
        }

        let eventListeners = wrappedListeners.get(eventName);
        if (!eventListeners) {
            eventListeners = new WeakMap();
            wrappedListeners.set(eventName, eventListeners);
        }

        let wrapped = eventListeners.get(listener);
        if (!wrapped) {
            wrapped = wrapSocketEventListener(listener, onError);
            eventListeners.set(listener, wrapped);
        }

        originalOn(eventName, wrapped);
        return this;
    };

    // EventEmitter.once() removes its internal listener through removeListener().
    // Translate the original callback back to its wrapper so once/off semantics
    // remain intact after payload validation is installed.
    socket.removeListener = function (eventName, listener) {
        originalRemoveListener(eventName, getWrappedListener(eventName, listener));
        return this;
    };
    socket.off = socket.removeListener;

    return socket;
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
    installSocketEventValidation,
    MAX_SESSION_DESCRIPTION_BYTES,
    MAX_ICE_CANDIDATE_BYTES,
    isValidSessionDescription,
    isValidIceCandidate
};
