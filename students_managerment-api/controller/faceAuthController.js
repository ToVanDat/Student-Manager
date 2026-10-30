'use strict';

const faceAuth = require('../service/faceAuthService.js');

function fail(res, error) {
    if (['FACE_SERVER_INFERENCE_NOT_READY', 'FACE_AUTH_CONFIG_NOT_READY', 'FACE_AUTH_UNAVAILABLE', 'FACE_INFERENCE_NOT_READY', 'FACE_LANDMARK_SERVICE_UNAVAILABLE', 'FACE_LANDMARK_SERVICE_AUTH_FAILED', 'FACE_LIVENESS_SIGNALS_INVALID'].includes(error?.code)) {
        return res.status(503).json({
            code: error.code,
            message: error.message
        });
    }
    if (error?.code === 'FACE_AUTH_CONFIG_NOT_READY' || error?.code === 'FACE_AUTH_CONFIG_INVALID' ||
        error?.code === 'FACE_AUTH_UNAVAILABLE' || error?.code === '42P01' || error?.code === '42703') {
        return res.status(503).json({
            code: error.code || 'FACE_AUTH_SCHEMA_NOT_READY',
            message: 'Face Login chưa được cấu hình đầy đủ trên máy chủ.'
        });
    }
    if (error?.code?.startsWith('FACE_') && error.code !== 'FACE_SERVER_INFERENCE_NOT_READY') {
        const status = error.code === 'FACE_ENROLLMENT_IN_PROGRESS' ? 409
            : error.code === 'FACE_ACCOUNT_INACTIVE' ? 403
                : ['FACE_AUTH_CONFIG_NOT_READY', 'FACE_AUTH_UNAVAILABLE', 'FACE_INFERENCE_NOT_READY', 'FACE_LANDMARK_SERVICE_UNAVAILABLE', 'FACE_LANDMARK_SERVICE_AUTH_FAILED', 'FACE_LIVENESS_SIGNALS_INVALID'].includes(error.code) ? 503 : 400;
        return res.status(status).json({ code: error.code, message: error.message });
    }
    if (/challenge.*(hết hạn|đã được sử dụng)/i.test(error?.message || '')) {
        return res.status(400).json({ message: error.message });
    }
    if (/mật khẩu.*không đúng|hãy xác minh|xác minh.*(hết hạn|không đúng|đã được sử dụng)/i.test(error?.message || '')) {
        return res.status(400).json({ code: 'FACE_REAUTH_REQUIRED', message: error.message });
    }
    if (/tài khoản không hoạt động/i.test(error?.message || '')) {
        return res.status(403).json({ code: 'FACE_ACCOUNT_INACTIVE', message: error.message });
    }
    console.error('[FaceAuth] Request failed', { code: error?.code, name: error?.name });
    return res.status(500).json({ message: 'Không thể xử lý yêu cầu Face Login.' });
}

exports.status = async (req, res) => {
    try { return res.json(await faceAuth.getStatus(req.user.sub)); }
    catch (error) { return fail(res, error); }
};
exports.beginEnrollment = async (req, res) => {
    try { return res.status(201).json(await faceAuth.beginEnrollment(req.user.sub, req.body?.verificationToken, req.body?.currentPassword)); }
    catch (error) { return fail(res, error); }
};
exports.captureEnrollmentFrame = async (req, res) => {
    try { return res.status(202).json(await faceAuth.appendCaptureFrame('enrollment', req.body?.challengeId, req.body?.livenessNonce, req.file?.buffer, req.user.sub)); }
    catch (error) { return fail(res, error); }
};
exports.captureLoginFrame = async (req, res) => {
    try { return res.status(202).json(await faceAuth.appendCaptureFrame('login', req.body?.challengeId, req.body?.livenessNonce, req.file?.buffer)); }
    catch (error) { return fail(res, error); }
};
exports.finishEnrollment = async (req, res) => {
    try { return res.status(201).json(await faceAuth.finishEnrollment(req.user.sub, req.body?.challengeId)); }
    catch (error) { return fail(res, error); }
};
exports.cancelEnrollment = async (req, res) => {
    try { return res.json(await faceAuth.cancelEnrollment(req.user.sub, req.body?.challengeId)); }
    catch (error) { return fail(res, error); }
};
exports.beginLogin = async (req, res) => {
    try { return res.json(await faceAuth.beginLogin(req.body?.username)); }
    catch (error) { return fail(res, error); }
};
exports.finishLogin = async (req, res) => {
    try { return res.json(await faceAuth.finishLogin(req.body?.challengeId, req)); }
    catch (error) { return fail(res, error); }
};
exports.disable = async (req, res) => {
    try { return res.json(await faceAuth.disable(req.user.sub, req.body?.currentPassword, req.body?.verificationToken)); }
    catch (error) { return fail(res, error); }
};
