const isValidCallId = (value) =>
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 128;

const isValidCallType = (value) =>
    value === 'voice' || value === 'video';

module.exports = { isValidCallId, isValidCallType };
