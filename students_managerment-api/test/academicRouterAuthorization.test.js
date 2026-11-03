const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');

const authPath = require.resolve('../middleware/authMiddleware.js');
const permissionPath = require.resolve('../middleware/permissionMiddleware.js');
const controllerPath = require.resolve('../controller/academicController.js');
const routerPath = require.resolve('../router/academicRouter.js');

let permissionChecks = [];

require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: (req, res, next) => {
        const userId = req.headers['x-test-user-id'];
        const role = req.headers['x-test-role'];
        if (userId && role) req.user = { id: Number(userId), role };
        next();
    }
};

require.cache[permissionPath] = {
    id: permissionPath,
    filename: permissionPath,
    loaded: true,
    exports: permissionKey => (req, res, next) => {
        permissionChecks.push({ permissionKey, userId: req.user?.id, role: req.user?.role });
        next();
    }
};

require.cache[controllerPath] = {
    id: controllerPath,
    filename: controllerPath,
    loaded: true,
    exports: {
        getMyProfile: (req, res) => res.json({ userId: req.user.id }),
        getMyGrades: (req, res) => res.json({ userId: req.user.id }),
        getStudentByCode: (req, res) => res.json({
            studentCode: req.params.studentCode,
            actorUserId: req.user.id,
            actorRole: req.user.role
        })
    }
};

delete require.cache[routerPath];
const academicRouter = require('../router/academicRouter.js');

function listen(app) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
    });
}

test('academic routes enforce own-record user scope and admin-only direct student lookup', async () => {
    permissionChecks = [];
    const app = express();
    app.use('/api/academic', academicRouter);
    const server = await listen(app);
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}/api/academic`;

    try {
        const unauthenticated = await fetch(`${baseUrl}/me/grades`);
        assert.equal(unauthenticated.status, 401);

        const ownGrades = await fetch(`${baseUrl}/me/grades`, {
            headers: { 'x-test-user-id': '42', 'x-test-role': 'user' }
        });
        assert.equal(ownGrades.status, 200);
        assert.deepEqual(await ownGrades.json(), { userId: 42 });

        const userDirectLookup = await fetch(`${baseUrl}/students/SV-002`, {
            headers: { 'x-test-user-id': '42', 'x-test-role': 'user' }
        });
        assert.equal(userDirectLookup.status, 403);

        const adminDirectLookup = await fetch(`${baseUrl}/students/SV-002`, {
            headers: { 'x-test-user-id': '7', 'x-test-role': 'admin' }
        });
        assert.equal(adminDirectLookup.status, 200);
        assert.deepEqual(await adminDirectLookup.json(), {
            studentCode: 'SV-002',
            actorUserId: 7,
            actorRole: 'admin'
        });

        assert.deepEqual(permissionChecks, [{
            permissionKey: 'students.view',
            userId: 7,
            role: 'admin'
        }]);
    } finally {
        await close(server);
        delete require.cache[authPath];
        delete require.cache[permissionPath];
        delete require.cache[controllerPath];
        delete require.cache[routerPath];
    }
});
