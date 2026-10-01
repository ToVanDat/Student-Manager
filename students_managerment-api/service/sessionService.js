const authRepository =
    require('../repository/authRepository.js');


// ======================================================
// LẤY DANH SÁCH SESSION CỦA USER
// ======================================================

const getUserSessions = async (userId) => {

    const sessions =
        await authRepository.findSessionsByUserId(
            userId
        );

    return sessions;
};


// ======================================================
// REVOKE 1 SESSION
// ======================================================

const revokeSession = async (
    sessionId,
    userId
) => {

    // ==============================================
    // KIỂM TRA SESSION CÓ THUỘC USER KHÔNG
    // ==============================================

    const session =
        await authRepository.findSessionByIdAndUserId(
            sessionId,
            userId
        );


    if (!session) {

        throw new Error(
            'Session không tồn tại'
        );
    }


    // ==============================================
    // SESSION ĐÃ REVOKE
    // ==============================================

    if (session.revoked_at !== null) {

        return {
            alreadyRevoked: true,
            session
        };
    }


    // ==============================================
    // REVOKE SESSION
    // ==============================================

    const revokedSession =
        await authRepository.revokeSession(
            sessionId
        );


    // ==============================================
    // REVOKE TOÀN BỘ REFRESH TOKEN
    // CỦA SESSION
    // ==============================================

    await authRepository.revokeRefreshTokensBySessionId(
        sessionId
    );


    // ==============================================
    // SOCKET NOTIFICATION
    // ==============================================

    try {

        const {
            getIO
        } = require('../src/socket/socket.js');


        const io = getIO();


        io.to(
            `session:${sessionId}`
        ).emit(
            'session:revoked',
            {
                sessionId,
                reason: 'SESSION_REVOKED'
            }
        );

    } catch (error) {

        /*
            Socket notification thất bại
            không được làm revoke thất bại.
        */

        console.error(
            'Socket notification error:',
            error.message
        );
    }


    return {
        alreadyRevoked: false,
        session: revokedSession
    };
};


// ======================================================
// REVOKE CÁC SESSION KHÁC
// GIỮ LẠI SESSION HIỆN TẠI
// ======================================================

const revokeOtherSessions = async (
    userId,
    currentSessionId
) => {

    // ==============================================
    // LẤY TẤT CẢ SESSION CỦA USER
    // ==============================================

    const sessions =
        await authRepository.findSessionsByUserId(
            userId
        );


    // ==============================================
    // CHỈ LẤY SESSION ACTIVE
    // VÀ KHÔNG PHẢI SESSION HIỆN TẠI
    // ==============================================

    const otherSessions =
        sessions.filter(
            (session) =>
                session.revoked_at === null &&
                session.id !== currentSessionId
        );


    // ==============================================
    // REVOKE TỪNG SESSION
    // ==============================================

    for (
        const session
        of otherSessions
    ) {

        // ==========================================
        // REVOKE SESSION
        // ==========================================

        await authRepository.revokeSession(
            session.id
        );


        // ==========================================
        // REVOKE REFRESH TOKEN
        // ==========================================

        await authRepository.revokeRefreshTokensBySessionId(
            session.id
        );


        // ==========================================
        // SOCKET NOTIFICATION
        // ==========================================

        try {

            const {
                getIO
            } = require('../src/socket/socket.js');


            const io = getIO();


            io.to(
                `session:${session.id}`
            ).emit(
                'session:revoked',
                {
                    sessionId: session.id,
                    reason: 'OTHER_SESSIONS_REVOKED'
                }
            );

        } catch (error) {

            console.error(
                'Socket notification error:',
                error.message
            );
        }
    }


    // ==============================================
    // RETURN
    // ==============================================

    return {
        revokedCount:
            otherSessions.length
    };
};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    getUserSessions,

    revokeSession,

    revokeOtherSessions

};