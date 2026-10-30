const { getCooldownState } = require('../service/passwordLoginProtection');

async function passwordLoginProtection(req, res, next) {
    const username = req.body?.username;
    if (!username || !String(username).trim()) return next();

    try {
        const state = await getCooldownState(username, req.ip);
        if (!state.active) return next();

        res.setHeader('Retry-After', String(state.retryAfterSeconds));
        return res.status(429).json({
            code: 'LOGIN_COOLDOWN',
            message: 'Bạn đang thực hiện quá nhiều yêu cầu đăng nhập. Vui lòng chờ một lúc rồi thử lại.'
        });
    } catch (error) {
        console.error('[AUTH][password protection unavailable]', error.code || error.message);
        return res.status(503).json({
            code: 'AUTH_PROTECTION_UNAVAILABLE',
            message: 'Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.'
        });
    }
}

module.exports = passwordLoginProtection;
