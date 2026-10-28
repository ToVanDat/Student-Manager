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
const uploadStudentCsv = require('../middleware/studentCsvUpload.js');


// Standard users can only read their own verified student link and academic records.
router.get('/me', authMiddleware, requireRole('user'), studentController.getMyStudentPortal);

// Sensitive admin-only account-to-student identity verification workflow.
router.get('/account-links', authMiddleware, requireRole('admin'), requirePermission('students.link_accounts'), studentController.getStudentAccountLinks);
router.post('/account-links', authMiddleware, requireRole('admin'), requirePermission('students.link_accounts'), studentController.createStudentAccountLink);
router.delete('/account-links/:userId', authMiddleware, requireRole('admin'), requirePermission('students.link_accounts'), studentController.deleteStudentAccountLink);

// Admin-only export; uses the same view permission as the roster.
router.get('/export', authMiddleware, requireRole('admin'), requirePermission('students.view'), studentController.exportStudentsCsv);

// CSV import is an explicit two-step admin workflow: preview first, then confirm.
router.post('/import/preview', authMiddleware, requireRole('admin'), requirePermission('students.manage'), uploadStudentCsv, studentController.previewStudentCsvImport);
router.post('/import', authMiddleware, requireRole('admin'), requirePermission('students.manage'), uploadStudentCsv, studentController.importStudentsCsv);

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
    requirePermission('students.manage'),
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


// Direct student record lookup remains admin-only; standard users use the verified /me endpoint.
router.get(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    requirePermission('students.view'),
    studentController.getStudentById
);

module.exports = router;