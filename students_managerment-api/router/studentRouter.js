const express = require('express');

const router = express.Router();

const studentController =
    require('../controller/student_controller.js');

const authMiddleware =
    require('../middleware/authMiddleware.js');

const requireRole =
    require('../middleware/roleMiddleware.js');
const requirePermission = require('../middleware/permissionMiddleware.js');

const validateStudent = require('../middleware/studentValidation.js');


// Admin only: list responses include personal student data.
router.get(
    '/',
    authMiddleware,
    requireRole('admin'),
    requirePermission('students.view'),
    studentController.getAllStudents
);


// Admin
router.post(
    '/',
    authMiddleware,
    requireRole('admin'),
    requirePermission('students.manage'),
    validateStudent,
    studentController.createStudent
);

router.patch(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    validateStudent.partial,
    studentController.updateStudent
);

router.delete(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    requirePermission('students.manage'),
    studentController.deleteStudent
);


// Admin only: student records are not yet linked to user accounts for self-service access.
router.get(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    requirePermission('students.view'),
    studentController.getStudentById
);

module.exports = router;