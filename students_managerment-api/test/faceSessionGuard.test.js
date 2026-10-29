'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadRepositoryWithPool(pool) {
    const databasePath = require.resolve('../src/config/database.js');
    const repositoryPath = require.resolve('../repository/authRepository.js');
    const previousDatabase = require.cache[databasePath];
    const previousRepository = require.cache[repositoryPath];

    require.cache[databasePath] = {
        id: databasePath,
        filename: databasePath,
        loaded: true,
        exports: pool
    };
    delete require.cache[repositoryPath];

    const repository = require('../repository/authRepository.js');

    return {
        repository,
        restore() {
            delete require.cache[repositoryPath];
            if (previousRepository) require.cache[repositoryPath] = previousRepository;
            if (previousDatabase) require.cache[databasePath] = previousDatabase;
            else delete require.cache[databasePath];
        }
    };
}

test('createSessionForActiveUser inserts only when the account is active', async () => {
    let captured;
    const fakePool = {
        query: async (sql, values) => {
            captured = { sql, values };
            return { rows: [{ id: 'session-1', user_id: '42' }] };
        }
    };
    const loaded = loadRepositoryWithPool(fakePool);

    try {
        const session = await loaded.repository.createSessionForActiveUser(
            '42', 'Browser', 'Example UA', '127.0.0.1'
        );

        assert.equal(session.id, 'session-1');
        assert.match(captured.sql, /INSERT\s+INTO\s+sessions/i);
        assert.match(captured.sql, /FROM\s+users/i);
        assert.match(captured.sql, /is_active\s*=\s*TRUE/i);
        assert.deepEqual(captured.values.slice(1), ['42', 'Browser', 'Example UA', '127.0.0.1']);
    } finally {
        loaded.restore();
    }
});

test('createSessionForActiveUser returns null when no active account row is inserted', async () => {
    const fakePool = {
        query: async () => ({ rows: [] })
    };
    const loaded = loadRepositoryWithPool(fakePool);

    try {
        const session = await loaded.repository.createSessionForActiveUser(
            '42', 'Browser', 'Example UA', '127.0.0.1'
        );
        assert.equal(session, null);
    } finally {
        loaded.restore();
    }
});


test('createSessionForActiveFaceUser requires an active account and enabled face credential', async () => {
    let captured;
    const fakePool = {
        query: async (sql, values) => {
            captured = { sql, values };
            return { rows: [{ id: 'face-session-1', user_id: '42' }] };
        }
    };
    const loaded = loadRepositoryWithPool(fakePool);

    try {
        const session = await loaded.repository.createSessionForActiveFaceUser(
            '42', 'Browser', 'Example UA', '127.0.0.1', 'face-credential-1'
        );

        assert.equal(session.id, 'face-session-1');
        assert.match(captured.sql, /active_user/i);
        assert.match(captured.sql, /is_active\s*=\s*TRUE/i);
        assert.match(captured.sql, /user_face_credentials/i);
        assert.match(captured.sql, /disabled_at\s+IS\s+NULL/i);
        assert.match(captured.sql, /FOR\s+UPDATE/i);
        assert.match(captured.sql, /INSERT\s+INTO\s+sessions/i);
        assert.deepEqual(captured.values.slice(1, 5), ['42', 'Browser', 'Example UA', '127.0.0.1']);
        assert.equal(captured.values[5], 'face-credential-1');
    } finally {
        loaded.restore();
    }
});

test('createSessionForActiveFaceUser refuses session creation without an active face credential', async () => {
    const fakePool = {
        query: async () => ({ rows: [] })
    };
    const loaded = loadRepositoryWithPool(fakePool);

    try {
        const session = await loaded.repository.createSessionForActiveFaceUser(
            '42', 'Browser', 'Example UA', '127.0.0.1', 'missing-credential'
        );
        assert.equal(session, null);
    } finally {
        loaded.restore();
    }
});


test('createSessionForActiveFaceUser fails closed without the matched credential id', async () => {
    let queried = false;
    const loaded = loadRepositoryWithPool({
        query: async () => { queried = true; return { rows: [] }; }
    });
    try {
        const session = await loaded.repository.createSessionForActiveFaceUser(
            '42', 'Browser', 'Example UA', '127.0.0.1'
        );
        assert.equal(session, null);
        assert.equal(queried, false);
    } finally {
        loaded.restore();
    }
});
