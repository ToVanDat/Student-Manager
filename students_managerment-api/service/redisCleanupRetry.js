const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 100;

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a post-commit Redis cleanup a small, bounded number of times.
 * The committed PostgreSQL credential change is never rolled back because
 * Redis is unavailable. This is an in-request retry, not a durable outbox.
 */
async function retryRedisCleanup(cleanup, {
    operation = 'password protection cleanup',
    attempts = DEFAULT_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    logger = console
} = {}) {
    if (typeof cleanup !== 'function') {
        throw new TypeError('cleanup must be a function');
    }

    const maxAttempts = Math.max(1, Math.floor(Number(attempts) || DEFAULT_ATTEMPTS));
    const delayMs = Math.max(0, Number(baseDelayMs) || 0);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await cleanup();
            return { succeeded: true, attempts: attempt };
        } catch (error) {
            if (attempt === maxAttempts) {
                logger.warn(
                    `[AUTH] ${operation} failed after ${maxAttempts} attempts:`,
                    error.code || error.message
                );
                return { succeeded: false, attempts: attempt };
            }

            await wait(delayMs * (2 ** (attempt - 1)));
        }
    }

    return { succeeded: false, attempts: maxAttempts };
}

module.exports = { retryRedisCleanup };
