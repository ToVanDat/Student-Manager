const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidNegotiationId = value =>
    typeof value === 'string' && UUID_PATTERN.test(value);

export const createNegotiationId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    if (globalThis.crypto?.getRandomValues) {
        const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    throw new Error('Secure random UUID generation is unavailable.');
};

export const isCurrentNegotiation = (incomingId, activeId) =>
    isValidNegotiationId(incomingId) && incomingId === activeId;


/**
 * Deterministic Perfect Negotiation roles for a one-to-one call:
 * the caller is impolite; the callee is polite and rolls back on glare.
 */
export const getPerfectNegotiationRole = ({ isCaller }) => {
    if (typeof isCaller !== 'boolean') throw new TypeError('isCaller must be boolean');
    return { polite: !isCaller };
};

export const shouldIgnoreOfferCollision = ({ polite, signalingState }) => {
    if (typeof polite !== 'boolean') throw new TypeError('polite must be boolean');
    if (signalingState === 'stable') return false;
    return !polite;
};

export const canRollbackLocalOffer = signalingState =>
    signalingState === 'have-local-offer';
