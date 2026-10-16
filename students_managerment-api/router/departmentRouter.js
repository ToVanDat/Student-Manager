const express = require('express');

const controller = require('../controller/department_controller.js');

const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const requireRole = require('../middleware/roleMiddleware.js');
const { validateResourceId, validateObjectBody } = require('../middleware/catalogRequestValidation.js');

router.use(authMiddleware);

router.get('/', controller.getAllDepartments);
router.get('/:id', validateResourceId, controller.getDepartmentById);
router.post('/', requireRole('admin'), validateObjectBody(), controller.createDepartment);
router.patch('/:id', requireRole('admin'), validateResourceId, validateObjectBody({ partial: true }), controller.updateDepartment);
router.delete('/:id', requireRole('admin'), validateResourceId, controller.deleteDepartment);

module.exports = router;