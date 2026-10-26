const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');
const controller = require('../controller/permissionController');

const router = express.Router();
router.use(authMiddleware, requireRole('admin'), requirePermission('permissions.manage'));
router.get('/', controller.listAll);
router.get('/roles/:role', controller.listForRole);
router.put('/roles/:role', controller.updateForRole);

module.exports = router;
