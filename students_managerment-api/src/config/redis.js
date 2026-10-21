// Redis connection configuration.
require('dotenv').config();
// Supports local development (localhost) and Docker Compose (REDIS_HOST=redis).
const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || (
    process.env.REDIS_HOST
        ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
        : 'redis://localhost:6379'
);

const redisClient = createClient({ url: redisUrl });

// Avoid flooding the terminal when Redis is temporarily unavailable.
// Log the first error in an outage and report recovery when Redis is ready again.
let redisConnectionErrorLogged = false;

redisClient.on('error', (error) => {
    if (redisConnectionErrorLogged) return;
    redisConnectionErrorLogged = true;
    console.error('[Redis] Connection error:', error.message);
});

redisClient.on('ready', () => {
    if (redisConnectionErrorLogged) {
        console.log('[Redis] Connection restored.');
        redisConnectionErrorLogged = false;
    }
});

const connectRedis = async () => {
    await redisClient.connect();
    console.log('Redis connected!');
};

module.exports = {
    redisClient,
    connectRedis
};
