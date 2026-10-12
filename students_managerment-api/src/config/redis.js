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

redisClient.on('error', (error) => {
    console.error('Redis Error:', error.message);
});

const connectRedis = async () => {
    await redisClient.connect();
    console.log('Redis connected!');
};

module.exports = {
    redisClient,
    connectRedis
};
