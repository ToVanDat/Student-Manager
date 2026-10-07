const sessionService =
    require('../service/sessionService.js');


// GET /api/auth/sessions
const getSessions = async (req, res) => {
    try {
        const userId = req.user.sub;

        const sessions =
            await sessionService.getUserSessions(userId);

        return res.status(200).json({
            sessions
        });

    } catch (error) {
        console.error(
            'LỖI GET SESSIONS:',
            error
        );

        return res.status(500).json({
            message:
                'Không thể lấy danh sách session'
        });
    }
};


// DELETE /api/auth/sessions/:sessionId
const revokeSession = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({
                message:
                    'Session ID không tồn tại'
            });
        }

        const result =
            await sessionService.revokeSession(
                sessionId,
                userId
            );

        return res.status(200).json({
            message:
                result.alreadyRevoked
                    ? 'Session đã được revoke trước đó'
                    : 'Revoke session thành công',

            session:
                result.session
        });

    } catch (error) {
        console.error(
            'LỖI REVOKE SESSION:',
            error
        );

        if (
            error.message ===
            'Session không tồn tại'
        ) {
            return res.status(404).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message:
                'Không thể revoke session'
        });
    }
};


// POST /api/auth/sessions/revoke-all
const revokeOtherSessions = async (req, res) => {

    try {

        const userId =
            req.user.sub;

        const currentSessionId =
            req.user.sessionId;


        const result =
            await sessionService.revokeOtherSessions(
                userId,
                currentSessionId
            );


        return res.status(200).json({
            message:
                'Đã revoke các session khác',

            revokedCount:
                result.revokedCount
        });

    } catch (error) {

        console.error(
            'LỖI REVOKE OTHER SESSIONS:',
            error
        );

        return res.status(500).json({
            message:
                'Không thể revoke các session khác'
        });
    }
};


module.exports = {
    getSessions,
    revokeSession,
    revokeOtherSessions
};