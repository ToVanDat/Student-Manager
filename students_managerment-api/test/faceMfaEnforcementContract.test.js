'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('all non-face primary authentication paths share the pending Face MFA gate', () => {
    const advanced = read('service/advancedAuthService.js');
    const password = read('service/authService.js');
    const controller = read('controller/advancedAuthController.js');
    const passwordController = read('controller/auth_controller.js');
    assert.match(advanced, /user\.require_face_mfa === true[\s\S]*?pendingFaceMfa\.createPendingAuth/);
    assert.match(advanced, /authMethod: 'google'/);
    assert.match(advanced, /authMethod: 'passkey'/);
    assert.match(advanced, /authMethod: 'qr'/);
    assert.match(password, /user\.require_face_mfa === true[\s\S]*?pendingFaceMfa\.createPendingAuth/);
    assert.match(controller, /requiresFaceMfa === true[\s\S]*?return res\.status\(202\)/);
    assert.match(passwordController, /requiresFaceMfa === true[\s\S]*?return res\.status\(202\)/);
});

test('pending Face challenge is bound to the primary login and consumed before session issuance', () => {
    const face = read('service/faceAuthService.js');
    assert.match(face, /beginLogin\(username, pendingAuthId, req\)/);
    assert.match(face, /readPendingAuth\(pendingAuthId, req\)/);
    assert.match(face, /consumePendingAuth\(state\.pendingAuthId, user\.id, req\)/);
    assert.match(face, /requireFaceCredential: true/);
});

test('HTTP, refresh and Socket.IO authorization reject sessions without Face MFA assurance', () => {
    const middleware = read('middleware/authMiddleware.js');
    const authRepo = read('repository/authRepository.js');
    const authService = read('service/authService.js');
    assert.match(middleware, /currentUser\.require_face_mfa === true && !session\.face_mfa_verified_at/);
    assert.match(authService, /user\.require_face_mfa === true && !session\.face_mfa_verified_at/);
    assert.match(authRepo, /account\.require_face_mfa = FALSE OR session\.face_mfa_verified_at IS NOT NULL/);
});

test('changing the Face MFA policy invalidates all sessions and refresh tokens', () => {
    const policy = read('service/faceMfaPolicyService.js');
    const repository = read('repository/authRepository.js');
    assert.match(policy, /setFaceMfaPolicyAndRevokeSessions\(userId, enabled\)/);
    assert.match(repository, /UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP[\s\S]*?UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP/);
});
