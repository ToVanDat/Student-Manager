const express = require('express');

const controller = require('../controller/department_controller.js');

const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const requireRole = require('../middleware/roleMiddleware.js');
const requirePermission = require('../middleware/permissionMiddleware.js');
const { validateResourceId, validateObjectBody } = require('../middleware/catalogRequestValidation.js');

router.use(authMiddleware);

router.get('/', requirePermission('departments.view'), controller.getAllDepartments);
router.get('/:id', requirePermission('departments.view'), validateResourceId, controller.getDepartmentById);
router.post('/', requireRole('admin'), requirePermission('departments.manage'), validateObjectBody(), controller.createDepartment);
router.patch('/:id', requireRole('admin'), requirePermission('departments.manage'), validateResourceId, validateObjectBody({ partial: true }), controller.updateDepartment);
router.delete('/:id', requireRole('admin'), requirePermission('departments.manage'), validateResourceId, controller.deleteDepartment);

module.exports = router;