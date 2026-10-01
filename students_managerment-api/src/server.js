const http = require('http');

const app = require('./app');
const { connectRedis } = require('./config/redis');
const { initSocket } = require('./socket/socket');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const startServer = async () => {
    try {
        await connectRedis();
        console.log('>>> BEFORE INIT SOCKET');
        // Khởi tạo Socket.IO
        initSocket(server);
        console.log('>>> AFTER INIT SOCKET');
        // Chạy HTTP server
        server.listen(PORT, () => {
            console.log(
                `Server running at http://localhost:${PORT}`
            );
        });

    } catch (error) {
        console.error(
            'Không thể khởi động server:',
            error
        );

        process.exit(1);
    }
};

startServer();