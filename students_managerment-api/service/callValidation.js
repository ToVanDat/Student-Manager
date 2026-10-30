const isValidCallId = (value) =>
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 128;

const isValidCallType = (value) =>
    value === 'voice' || value === 'video';

const CALL_FAILURE_REASONS = new Set([
    'connection-timeout',
    'ice-failed',
    'peer-connection-failed',
    'media-error',
    'network-error'
]);

const normalizeCallFailureReason = (value) =>
    typeof value === 'string' && CALL_FAILURE_REASONS.has(value)
        ? value
        : 'connection-failed';

module.exports = { isValidCallId, isValidCallType, normalizeCallFailureReason };
