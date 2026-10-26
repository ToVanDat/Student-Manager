const http = require('http');

const app = require('./app');
const pool = require('./config/database');
const { connectRedis, redisClient } = require('./config/redis');
const { initSocket, closeSocket } = require('./socket/socket');

const PORT = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT_MS = 10000;

const server = http.createServer(app);
let shutdownPromise = null;

const closeHttpServer = async () => {
    if (!server.listening) return;
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
};

const shutdown = (signal) => {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
        console.log(`Received ${signal}; starting graceful shutdown.`);
        const forceExitTimer = setTimeout(() => {
            console.error('Graceful shutdown timed out.');
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
        forceExitTimer.unref();

        try {
            // Socket.IO owns upgraded connections and its Redis Pub/Sub subscriber.
            await closeSocket();
            await closeHttpServer();

            if (redisClient.isOpen) {
                await redisClient.quit();
            }
            await pool.end();

            clearTimeout(forceExitTimer);
            console.log('Graceful shutdown completed.');
            process.exitCode = 0;
        } catch (error) {
            clearTimeout(forceExitTimer);
            console.error('Graceful shutdown failed:', error.message);
            process.exitCode = 1;
        }
    })();

    return shutdownPromise;
};

const startServer = async () => {
    try {
        await connectRedis();
        await initSocket(server);

        server.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (error) {
        console.error('Không thể khởi động server:', error.message);
        await closeSocket().catch(() => {});
        if (redisClient.isOpen) {
            await redisClient.quit().catch(() => {});
        }
        await pool.end().catch(() => {});
        process.exitCode = 1;
    }
};

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });

startServer();
