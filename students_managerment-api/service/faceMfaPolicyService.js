'use strict';

const pool = require('../src/config/database.js');
const { verifySensitiveAction } = require('./advancedAuthService.js');
const { ensureFaceMfaPipelineReady } = require('./faceAuthService.js');

function policyError(code, message, status = 400) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
}

async function getPolicy(userId) {
    const result = await pool.query(
        `SELECT u.require_face_mfa,
                EXISTS (SELECT 1 FROM user_face_credentials f WHERE f.user_id = u.id AND f.disabled_at IS NULL) AS face_credential_configured
         FROM users u WHERE u.id = $1 AND u.is_active = TRUE`,
        [userId]
    );
    const row = result.rows[0];
    if (!row) throw policyError('FACE_MFA_ACCOUNT_NOT_FOUND', 'Tài khoản không tồn tại hoặc đã bị khóa.', 403);
    return {
        enabled: row.require_face_mfa === true,
        faceCredentialConfigured: row.face_credential_configured === true,
        pipelineReady: process.env.FACE_AUTH_PIPELINE_ENABLED === 'true' && process.env.FACE_AUTH_PIPELINE_VALIDATED === 'true'
    };
}

async function setPolicy(userId, enabled, currentPassword, verificationToken) {
    if (typeof enabled !== 'boolean') throw policyError('FACE_MFA_POLICY_INVALID', 'Giá trị chính sách Face MFA không hợp lệ.');
    const purpose = enabled ? 'face-mfa-enable' : 'face-mfa-disable';
    await verifySensitiveAction(userId, currentPassword, verificationToken, purpose);

    if (enabled) {
        if (process.env.FACE_AUTH_PIPELINE_ENABLED !== 'true' || process.env.FACE_AUTH_PIPELINE_VALIDATED !== 'true') {
            throw policyError('FACE_MFA_PIPELINE_NOT_READY', 'Không thể bật Face MFA khi pipeline chưa được kiểm định.', 503);
        }
        await ensureFaceMfaPipelineReady();
        const credential = await pool.query(
            'SELECT 1 FROM user_face_credentials WHERE user_id = $1 AND disabled_at IS NULL LIMIT 1',
            [userId]
        );
        if (!credential.rows[0]) throw policyError('FACE_MFA_CREDENTIAL_REQUIRED', 'Hãy đăng ký Face Login trước khi bật Face MFA.');
    }

    const updated = await pool.query(
        `UPDATE users SET require_face_mfa = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND is_active = TRUE RETURNING require_face_mfa`,
        [userId, enabled]
    );
    if (!updated.rows[0]) throw policyError('FACE_MFA_ACCOUNT_NOT_FOUND', 'Tài khoản không tồn tại hoặc đã bị khóa.', 403);

    // Deliberately do not grandfather existing sessions. On enable they are
    // blocked by middleware/refresh/socket assurance checks; on disable the
    // client must end the current session and sign in again under the new policy.
    return { enabled: updated.rows[0].require_face_mfa === true, requiresSignInAgain: true };
}

module.exports = { getPolicy, setPolicy };
