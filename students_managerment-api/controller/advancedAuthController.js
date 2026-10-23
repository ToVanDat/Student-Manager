const advancedAuth = require('../service/advancedAuthService.js');

function setRefreshCookie(res, token) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth'
    });
}
function fail(res, error) {
    const message = error?.message || 'Yêu cầu xác thực thất bại';

    if (/chưa được cấu hình/.test(message)) {
        return res.status(503).json({ message });
    }

    // Known, expected authentication/business-rule failures can be returned to the client.
    const isExpectedFailure =
        /hết hạn|không hợp lệ|không đúng|không thuộc|không được liên kết|đã liên kết|chưa đăng ký|không tìm thấy|đã xử lý|không hoạt động|đã được sử dụng|chưa xác minh|đã bị khóa|gỡ liên kết|mật khẩu/i.test(message);
    if (isExpectedFailure) {
        const status = /đã bị khóa|không hoạt động/.test(message) ? 403 : 400;
        return res.status(status).json({ message });
    }

    // Database/infrastructure exceptions must not be misreported as HTTP 401 or
    // expose SQL/schema details to clients. Log only non-secret diagnostics.
    console.error('[AdvancedAuth] Unexpected authentication failure', {
        name: error?.name || 'Error',
        code: typeof error?.code === 'string' ? error.code : undefined
    });
    return res.status(500).json({ message: 'Đã xảy ra lỗi hệ thống khi xác thực. Vui lòng thử lại.' });
}
function sendSession(res, result) {
    setRefreshCookie(res, result.refreshToken);
    return res.status(200).json({
        user: result.user,
        accessToken: result.accessToken,
        message: 'Đăng nhập thành công'
    });
}

exports.linkGoogle = async (req, res) => {
    try {
        const result = await advancedAuth.linkGoogle(req.user.sub, req.body?.idToken, req.body?.currentPassword, req.body?.verificationToken);
        return res.json({ message: 'Đã liên kết Google với tài khoản hiện tại', account: result });
    } catch (error) { return fail(res, error); }
};
exports.getGoogleLink = async (req, res) => {
    try {
        return res.json({ account: await advancedAuth.getGoogleLink(req.user.sub) });
    } catch (error) { return fail(res, error); }
};
exports.unlinkGoogle = async (req, res) => {
    try {
        await advancedAuth.unlinkGoogle(req.user.sub, req.body?.currentPassword, req.body?.verificationToken);
        return res.status(200).json({ message: 'Đã gỡ liên kết Google' });
    } catch (error) { return fail(res, error); }
};
exports.loginGoogle = async (req, res) => {
    try { return sendSession(res, await advancedAuth.loginGoogle(req.body?.idToken, req)); }
    catch (error) { return fail(res, error); }
};
exports.beginSensitiveReauth = async (req, res) => {
    try { return res.json(await advancedAuth.beginSensitiveReauth(req.user.sub)); }
    catch (error) { return fail(res, error); }
};
exports.finishSensitiveReauth = async (req, res) => {
    try { return res.json(await advancedAuth.finishSensitiveReauth(req.user.sub, req.body?.challengeId, req.body?.response)); }
    catch (error) { return fail(res, error); }
};
exports.beginPasskeyRegistration = async (req, res) => {
    try { return res.json(await advancedAuth.beginPasskeyRegistration(req.user.sub)); }
    catch (error) { return fail(res, error); }
};
exports.finishPasskeyRegistration = async (req, res) => {
    try {
        const result = await advancedAuth.finishPasskeyRegistration(
            req.user.sub, req.body?.challengeId, req.body?.response, req.body?.deviceName
        );
        return res.status(201).json({ message: 'Đăng ký passkey thành công', ...result });
    } catch (error) { return fail(res, error); }
};
exports.beginPasskeyLogin = async (req, res) => {
    try { return res.json(await advancedAuth.beginPasskeyLogin(req.body?.username)); }
    catch (error) { return fail(res, error); }
};
exports.finishPasskeyLogin = async (req, res) => {
    try {
        return sendSession(res, await advancedAuth.finishPasskeyLogin(req.body?.challengeId, req.body?.response, req));
    } catch (error) { return fail(res, error); }
};
exports.listPasskeys = async (req, res) => {
    try { return res.json({ credentials: await advancedAuth.listPasskeys(req.user.sub) }); }
    catch (error) { return fail(res, error); }
};
exports.deletePasskey = async (req, res) => {
    try {
        await advancedAuth.deletePasskey(req.user.sub, req.params.id);
        return res.status(204).end();
    } catch (error) { return fail(res, error); }
};
exports.createQrLogin = async (_req, res) => {
    try { return res.status(201).json(await advancedAuth.createQrLogin()); }
    catch (error) { return fail(res, error); }
};
exports.approveQrLogin = async (req, res) => {
    try {
        return res.json(await advancedAuth.approveQrLogin(
            req.user.sub, req.body?.requestId, req.body?.secret, req.user.sessionId
        ));
    } catch (error) { return fail(res, error); }
};
exports.denyQrLogin = async (req, res) => {
    try { return res.json(await advancedAuth.denyQrLogin(req.body?.requestId, req.body?.secret, req.body?.status)); }
    catch (error) { return fail(res, error); }
};
exports.pollQrLogin = async (req, res) => {
    try {
        const result = await advancedAuth.pollQrLogin(req.body?.requestId, req.body?.secret, req);
        if (result.status === 'consumed') return sendSession(res, result);
        return res.json(result);
    } catch (error) { return fail(res, error); }
};
