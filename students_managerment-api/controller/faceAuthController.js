const faceAuth = require('../service/faceAuthService.js');

function respondError(res, error) {
    const message = error?.message || 'Face Login request failed';
    const status = /chưa được cấu hình/.test(message) ? 503
        : /không hợp lệ|hết hạn|đã sử dụng|đã đăng ký|không tìm thấy/.test(message) ? 400
        : 500;
    if (status === 500) console.error('[FaceAuth]', message);
    return res.status(status).json({ message: status === 500 ? 'Không thể xử lý yêu cầu Face Login' : message });
}

exports.createEnrollmentChallenge = async (req, res) => {
    try {
        return res.status(201).json(await faceAuth.createEnrollmentChallenge(req.user.sub));
    } catch (error) { return respondError(res, error); }
};

exports.completeEnrollment = async (req, res) => {
    try {
        const result = await faceAuth.completeEnrollment(req.user.sub, req.body?.challengeId, req.body?.embedding);
        return res.status(201).json({ message: 'Đã đăng ký mẫu khuôn mặt. Tính năng đăng nhập bằng khuôn mặt chưa được bật cho đến khi hoàn tất xác minh chống giả mạo phía máy chủ.', credential: result });
    } catch (error) { return respondError(res, error); }
};

exports.getCredential = async (req, res) => {
    try {
        return res.json({ credential: await faceAuth.getCredential(req.user.sub) });
    } catch (error) { return respondError(res, error); }
};

exports.revokeCredential = async (req, res) => {
    try {
        await faceAuth.revokeCredential(req.user.sub);
        return res.status(200).json({ message: 'Đã thu hồi đăng ký khuôn mặt' });
    } catch (error) { return respondError(res, error); }
};
