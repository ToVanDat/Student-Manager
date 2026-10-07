// connect to redis

const { createClient } = require('redis');

const redisClient = createClient({
    url: 'redis://localhost:6379'
});

redisClient.on('error', (error) => {
    console.error('Redis Error:', error);
});

const connectRedis = async () => {
    await redisClient.connect();
    console.log('Redis connected!');
};

module.exports = {
    redisClient,
    connectRedis
};