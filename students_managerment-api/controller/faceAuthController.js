'use strict';

const faceAuth = require('../service/faceAuthService.js');

function fail(res, error) {
    if (error?.code === 'FACE_SERVER_INFERENCE_NOT_READY') {
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
    if (/challenge.*(hết hạn|đã được sử dụng)/i.test(error?.message || '')) {
        return res.status(400).json({ message: error.message });
    }
    console.error('[FaceAuth] Request failed', { code: error?.code, name: error?.name });
    return res.status(500).json({ message: 'Không thể xử lý yêu cầu Face Login.' });
}

exports.status = async (req, res) => {
    try { return res.json(await faceAuth.getStatus(req.user.sub)); }
    catch (error) { return fail(res, error); }
};
exports.beginEnrollment = async (req, res) => {
    try { return res.status(201).json(await faceAuth.beginEnrollment(req.user.sub)); }
    catch (error) { return fail(res, error); }
};
exports.finishEnrollment = async (req, res) => {
    try { return res.status(201).json(await faceAuth.finishEnrollment(req.user.sub, req.body?.challengeId)); }
    catch (error) { return fail(res, error); }
};
exports.beginLogin = async (req, res) => {
    try { return res.json(await faceAuth.beginLogin(req.body?.username)); }
    catch (error) { return fail(res, error); }
};
exports.finishLogin = async (req, res) => {
    try { return res.json(await faceAuth.finishLogin(req.body?.challengeId)); }
    catch (error) { return fail(res, error); }
};
exports.disable = async (req, res) => {
    try { return res.json(await faceAuth.disable(req.user.sub)); }
    catch (error) { return fail(res, error); }
};
