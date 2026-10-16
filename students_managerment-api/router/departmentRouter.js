const express = require('express');

const controller = require('../controller/department_controller.js');

const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const requireRole = require('../middleware/roleMiddleware.js');

router.use(authMiddleware);

router.get('/', controller.getAllDepartments);
router.get('/:id', controller.getDepartmentById);
router.post('/', requireRole('admin'), controller.createDepartment);
router.patch('/:id', requireRole('admin'), controller.updateDepartment);
router.delete('/:id', requireRole('admin'), controller.deleteDepartment);

module.exports = router;