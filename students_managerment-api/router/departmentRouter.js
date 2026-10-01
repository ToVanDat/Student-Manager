const express = require('express');

const controller = require('../controller/department_controller.js');

const router = express.Router();

router.get('/', controller.getAllDepartments);
router.get('/:id', controller.getDepartmentById);
router.post('/', controller.createDepartment);
router.patch('/:id', controller.updateDepartment);
router.delete('/:id', controller.deleteDepartment);

module.exports = router;