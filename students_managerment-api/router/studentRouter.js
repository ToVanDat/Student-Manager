const express = require('express');

const router = express.Router();

const studentController =
    require('../controller/student_controller.js');

const authMiddleware =
    require('../middleware/authMiddleware.js');

const requireRole =
    require('../middleware/roleMiddleware.js');


// User + Admin
router.get(
    '/',
    authMiddleware,
    studentController.getAllStudents
);


// Admin
router.post(
    '/',
    authMiddleware,
    requireRole('admin'),
    studentController.createStudent
);

router.patch(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    studentController.updateStudent
);

router.delete(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    studentController.deleteStudent
);


// User + Admin
router.get(
    '/:id',
    authMiddleware,
    studentController.getStudentById
);

module.exports = router;