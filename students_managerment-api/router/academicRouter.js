const express = require('express');
const authMiddleware = require('../middleware/authMiddleware.js');
const requireRole = require('../middleware/roleMiddleware.js');
const requirePermission = require('../middleware/permissionMiddleware.js');
const academicController = require('../controller/academicController.js');

const router = express.Router();

// Resolve own records only through the verified server-side account link.
router.get('/me', authMiddleware, requireRole('user'), academicController.getMyProfile);
router.get('/me/grades', authMiddleware, requireRole('user'), academicController.getMyGrades);

// Direct lookup is restricted to admins with roster-view permission.
router.get('/students/:studentCode', authMiddleware, requireRole('admin'), requirePermission('students.view'), academicController.getStudentByCode);

module.exports = router;
