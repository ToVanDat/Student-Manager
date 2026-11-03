'use strict';

function toSafeHttpError(error, fallbackMessage) {
    const candidate = Number.isInteger(error?.statusCode)
        ? error.statusCode
        : error?.status;
    const statusCode = Number.isInteger(candidate) && candidate >= 400 && candidate < 500
        ? candidate
        : 500;

    const clientMessage = typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : fallbackMessage;

    return {
        statusCode,
        message: statusCode === 500 ? fallbackMessage : clientMessage
    };
}

module.exports = { toSafeHttpError };
