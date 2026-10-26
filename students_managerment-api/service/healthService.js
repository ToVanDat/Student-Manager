async function runCheck(check) {
    try {
        await check();
        return 'ok';
    } catch {
        return 'unavailable';
    }
}

async function getReadiness({ pool, redisClient }) {
    const [database, redis] = await Promise.all([
        runCheck(() => pool.query('SELECT 1')),
        runCheck(() => {
            if (!redisClient?.isReady) {
                throw new Error('Redis is not ready');
            }
            return redisClient.ping();
        })
    ]);

    return {
        ready: database === 'ok' && redis === 'ok',
        checks: { database, redis }
    };
}

module.exports = { getReadiness };
