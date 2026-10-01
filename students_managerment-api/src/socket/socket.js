const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const authRepository = require('../../repository/authRepository.js');

let io = null;


// =====================================================
// INIT SOCKET.IO
// =====================================================

const initSocket = (server) => {

    io = new Server(server, {
        cors: {
            origin: 'http://localhost:5173',
            credentials: true
        }
    });


    // =================================================
    // SOCKET AUTHENTICATION
    // =================================================

    io.use(async (socket, next) => {

        try {

            // =========================================
            // GET ACCESS TOKEN
            // =========================================

            const accessToken =
                socket.handshake.auth?.accessToken;


            if (!accessToken) {

                return next(
                    new Error(
                        'Không có Access Token'
                    )
                );
            }


            // =========================================
            // VERIFY JWT
            // =========================================

            const decoded =
                jwt.verify(
                    accessToken,
                    process.env.JWT_SECRET,
                    {
                        issuer:
                            'student-management-api',

                        audience:
                            'student-management-client'
                    }
                );


            // =========================================
            // CHECK JWT DATA
            // =========================================

            if (
                !decoded.sub ||
                !decoded.sessionId
            ) {

                return next(
                    new Error(
                        'Access Token thiếu Session ID'
                    )
                );
            }


            // =========================================
            // CHECK SESSION IN DATABASE
            // =========================================

            const session =
                await authRepository
                    .findSessionByIdAndUserId(
                        decoded.sessionId,
                        decoded.sub
                    );


            if (!session) {

                return next(
                    new Error(
                        'Session không tồn tại'
                    )
                );
            }


            // =========================================
            // CHECK SESSION REVOKED
            // =========================================

            if (session.revoked_at !== null) {

                return next(
                    new Error(
                        'Session đã bị thu hồi'
                    )
                );
            }


            // =========================================
            // UPDATE LAST USED
            // =========================================

            await authRepository
                .updateSessionLastUsed(
                    decoded.sessionId
                );


            // =========================================
            // SAVE USER INFORMATION
            // =========================================

            socket.user = {

                id:
                    decoded.sub,

                username:
                    decoded.username,

                role:
                    decoded.role,

                sessionId:
                    decoded.sessionId
            };


            // =========================================
            // AUTHENTICATION SUCCESS
            // =========================================

            next();

        } catch (error) {

            console.error(
                'Socket authentication error:',
                error.message
            );

            next(
                new Error(
                    'Access Token không hợp lệ'
                )
            );
        }
    });


    // =================================================
    // SOCKET CONNECTION
    // =================================================

    io.on('connection', (socket) => {

        const sessionId =
            socket.user.sessionId;


        // =============================================
        // CREATE SESSION ROOM
        // =============================================

        const room =
            `session:${sessionId}`;


        socket.join(room);


        // =============================================
        // LOG CONNECTION
        // =============================================

        console.log(
            'Socket connected'
        );

        console.log(
            `User: ${socket.user.id}`
        );

        console.log(
            `Session: ${sessionId}`
        );

        console.log(
            `Room: ${room}`
        );


        // =============================================
        // DISCONNECT
        // =============================================

        socket.on(
            'disconnect',
            (reason) => {

                console.log(
                    'Socket disconnected'
                );

                console.log(
                    `Session: ${sessionId}`
                );

                console.log(
                    `Reason: ${reason}`
                );
            }
        );
    });


    return io;
};


// =====================================================
// GET IO
// =====================================================

const getIO = () => {

    if (!io) {

        throw new Error(
            'Socket.IO chưa được khởi tạo'
        );
    }

    return io;
};


// =====================================================
// EMIT SESSION REVOKED
// =====================================================

const emitSessionRevoked = (
    sessionId,
    reason = 'SESSION_REVOKED'
) => {

    const socketIO =
        getIO();


    // ================================================
    // SESSION ROOM
    // ================================================

    const room =
        `session:${sessionId}`;


    // ================================================
    // SEND EVENT
    // ================================================

    socketIO
        .to(room)
        .emit(
            'session:revoked',
            {
                sessionId,
                reason
            }
        );


    // ================================================
    // LOG
    // ================================================

    console.log(
        'Session revoked event sent'
    );

    console.log(
        `Session: ${sessionId}`
    );

    console.log(
        `Reason: ${reason}`
    );
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    initSocket,
    getIO,
    emitSessionRevoked
};