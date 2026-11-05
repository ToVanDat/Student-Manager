'use strict';

const policyService = require('../service/faceMfaPolicyService.js');

exports.getPolicy = async (req, res) => {
    try {
        return res.json(await policyService.getPolicy(req.user.sub));
    } catch (error) {
        if (['FACE_SERVER_INFERENCE_NOT_READY', 'FACE_AUTH_CONFIG_NOT_READY', 'FACE_AUTH_CONFIG_INVALID', 'FACE_INFERENCE_NOT_READY', 'FACE_LANDMARK_SERVICE_UNAVAILABLE', 'FACE_LANDMARK_SERVICE_AUTH_FAILED'].includes(error?.code)) {
            return res.status(503).json({ code: 'FACE_MFA_PIPELINE_NOT_READY', message: 'Pipeline Face chưa sẵn sàng hoặc chưa vượt qua kiểm định.' });
        }
        if (error?.code === '42P01' || error?.code === '42703') {
            return res.status(503).json({ code: 'FACE_MFA_SCHEMA_NOT_READY', message: 'Schema Face MFA chưa được áp dụng.' });
        }
        console.error('[FaceMfaPolicy] Read failed', { code: error?.code, name: error?.name });
        return res.status(error?.status || 500).json({ code: error?.code || 'FACE_MFA_POLICY_FAILED', message: error?.status ? error.message : 'Không thể đọc chính sách Face MFA.' });
    }
};

exports.setPolicy = async (req, res) => {
    try {
        const result = await policyService.setPolicy(
            req.user.sub,
            req.body?.enabled,
            req.body?.currentPassword,
            req.body?.verificationToken
        );
        return res.json({ ...result, message: result.enabled ? 'Đã bật yêu cầu Face MFA. Hãy đăng nhập lại và xác minh khuôn mặt.' : 'Đã tắt yêu cầu Face MFA. Hãy đăng nhập lại.' });
    } catch (error) {
        if (error?.code === '42P01' || error?.code === '42703') {
            return res.status(503).json({ code: 'FACE_MFA_SCHEMA_NOT_READY', message: 'Schema Face MFA chưa được áp dụng.' });
        }
        const expected = typeof error?.code === 'string' && error.code.startsWith('FACE_MFA_');
        if (expected) return res.status(error.status || 400).json({ code: error.code, message: error.message });
        if (/mật khẩu|xác minh|hết hạn|không đúng|đã được sử dụng/i.test(error?.message || '')) {
            return res.status(400).json({ code: 'FACE_MFA_REAUTH_REQUIRED', message: error.message });
        }
        console.error('[FaceMfaPolicy] Update failed', { code: error?.code, name: error?.name });
        return res.status(500).json({ code: 'FACE_MFA_POLICY_FAILED', message: 'Không thể cập nhật chính sách Face MFA.' });
    }
};
