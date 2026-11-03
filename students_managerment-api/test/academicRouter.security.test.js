const test = require('node:test');
const assert = require('node:assert/strict');

const authPath = require.resolve('../middleware/authMiddleware');
const rolePath = require.resolve('../middleware/roleMiddleware');
const permissionPath = require.resolve('../middleware/permissionMiddleware');
const controllerPath = require.resolve('../controller/academicController');
const routerPath = require.resolve('../router/academicRouter');

function installModule(path, exports) {
    require.cache[path] = {
        id: path,
        filename: path,
        loaded: true,
        exports
    };
}

function taggedMiddleware(type, value) {
    const middleware = function middleware(req, res, next) { return next(); };
    middleware.guardType = type;
    middleware.guardValue = value;
    return middleware;
}

test('academic routes compose authentication and role/permission guards before controllers', () => {
    const paths = [authPath, rolePath, permissionPath, controllerPath, routerPath];
    const previous = new Map(paths.map(path => [path, require.cache[path]]));
    const auth = taggedMiddleware('auth');
    const controller = {
        getMyProfile: taggedMiddleware('controller', 'getMyProfile'),
        getMyGrades: taggedMiddleware('controller', 'getMyGrades'),
        getStudentByCode: taggedMiddleware('controller', 'getStudentByCode')
    };

    installModule(authPath, auth);
    installModule(rolePath, role => taggedMiddleware('role', role));
    installModule(permissionPath, permission => taggedMiddleware('permission', permission));
    installModule(controllerPath, controller);
    delete require.cache[routerPath];

    try {
        const router = require('../router/academicRouter');
        const routes = new Map(router.stack
            .filter(layer => layer.route)
            .map(layer => [layer.route.path, layer.route.stack.map(item => item.handle)]));

        const ownProfile = routes.get('/me');
        assert.ok(ownProfile, 'GET /me route exists');
        assert.deepEqual(ownProfile.map(handler => [handler.guardType, handler.guardValue]), [
            ['auth', undefined],
            ['role', 'user'],
            ['controller', 'getMyProfile']
        ]);

        const ownGrades = routes.get('/me/grades');
        assert.ok(ownGrades, 'GET /me/grades route exists');
        assert.deepEqual(ownGrades.map(handler => [handler.guardType, handler.guardValue]), [
            ['auth', undefined],
            ['role', 'user'],
            ['controller', 'getMyGrades']
        ]);

        const adminLookup = routes.get('/students/:studentCode');
        assert.ok(adminLookup, 'GET /students/:studentCode route exists');
        assert.deepEqual(adminLookup.map(handler => [handler.guardType, handler.guardValue]), [
            ['auth', undefined],
            ['role', 'admin'],
            ['permission', 'students.view'],
            ['controller', 'getStudentByCode']
        ]);
    } finally {
        for (const path of paths) {
            delete require.cache[path];
            const original = previous.get(path);
            if (original) require.cache[path] = original;
        }
    }
});
