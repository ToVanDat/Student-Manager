const express = require('express');

const router = express.Router();

const studentController =
    require('../controller/student_controller.js');

const authMiddleware =
    require('../middleware/authMiddleware.js');

const requireRole =
    require('../middleware/roleMiddleware.js');

const validateStudent = require('../middleware/studentValidation.js');


// Admin only: list responses include personal student data.
router.get(
    '/',
    authMiddleware,
    requireRole('admin'),
    studentController.getAllStudents
);


// Admin
router.post(
    '/',
    authMiddleware,
    requireRole('admin'),
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
    studentController.deleteStudent
);


// Admin only: student records are not yet linked to user accounts for self-service access.
router.get(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    studentController.getStudentById
);

module.exports = router;