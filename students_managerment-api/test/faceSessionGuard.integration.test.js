'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = process.env.FACE_AUTH_DB_INTEGRATION === '1';

test('Face session issuance requires an active account and active credential in PostgreSQL', {
    skip: !enabled && 'Set FACE_AUTH_DB_INTEGRATION=1 against a dedicated disposable test database'
}, async t => {
    const pool = require('../src/config/database.js');
    const repository = require('../repository/authRepository.js');
    const userIds = [];

    t.after(async () => {
        if (userIds.length) {
            await pool.query('DELETE FROM sessions WHERE user_id = ANY($1::bigint[])', [userIds]);
            await pool.query('DELETE FROM user_face_credentials WHERE user_id = ANY($1::bigint[])', [userIds]);
            await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [userIds]);
        }
        await pool.end();
    });

    const active = await pool.query(
        'INSERT INTO users (is_active) VALUES (TRUE) RETURNING id'
    );
    const activeUserId = active.rows[0].id;
    userIds.push(activeUserId);

    await pool.query(
        'INSERT INTO user_face_credentials (user_id, ciphertext, nonce, auth_tag, key_version, model_id, model_version) VALUES ($1, $2, $3, $4, 1, $5, $6)',
        [activeUserId, Buffer.from([1]), Buffer.alloc(12), Buffer.alloc(16), 'test-model', 'test-version']
    );

    const credentialResult = await pool.query(
        'SELECT id, ciphertext, nonce, auth_tag, key_version, model_id, model_version FROM user_face_credentials WHERE user_id = $1 AND disabled_at IS NULL',
        [activeUserId]
    );
    const matchedCredential = {
        id: String(credentialResult.rows[0].id),
        ciphertext: credentialResult.rows[0].ciphertext,
        nonce: credentialResult.rows[0].nonce,
        authTag: credentialResult.rows[0].auth_tag,
        keyVersion: credentialResult.rows[0].key_version,
        modelId: credentialResult.rows[0].model_id,
        modelVersion: credentialResult.rows[0].model_version
    };
    const session = await repository.createSessionForActiveFaceUser(
        activeUserId, 'Face integration test', 'node:test', '127.0.0.1', matchedCredential
    );
    assert.ok(session?.id, 'active account with active Face credential should create a session');

    await pool.query(
        'UPDATE user_face_credentials SET ciphertext = $1 WHERE user_id = $2',
        [Buffer.from([9, 9, 9]), activeUserId]
    );
    const replacedCredentialSession = await repository.createSessionForActiveFaceUser(
        activeUserId, 'Face integration test', 'node:test', '127.0.0.1', matchedCredential
    );
    assert.equal(replacedCredentialSession, null, 'a replaced credential must not authorize the session');
    await pool.query(
        'UPDATE user_face_credentials SET ciphertext = $1 WHERE user_id = $2',
        [matchedCredential.ciphertext, activeUserId]
    );

    await pool.query(
        'UPDATE user_face_credentials SET disabled_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [activeUserId]
    );
    const disabledCredentialSession = await repository.createSessionForActiveFaceUser(
        activeUserId, 'Face integration test', 'node:test', '127.0.0.1', matchedCredential
    );
    assert.equal(disabledCredentialSession, null, 'disabled Face credential must not create a session');

    await pool.query(
        'UPDATE user_face_credentials SET disabled_at = NULL WHERE user_id = $1',
        [activeUserId]
    );
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = $1', [activeUserId]);
    const inactiveAccountSession = await repository.createSessionForActiveFaceUser(
        activeUserId, 'Face integration test', 'node:test', '127.0.0.1', matchedCredentialId
    );
    assert.equal(inactiveAccountSession, null, 'inactive account must not create a Face session');
});
