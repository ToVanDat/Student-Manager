const express = require('express');

const {
    getEnrollments,
    getEnrollmentById,
    createEnrollment,
    updateEnrollment,
    deleteEnrollment
} = require('../controller/enrollment_controller.js');

const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const requireRole = require('../middleware/roleMiddleware.js');
const requirePermission = require('../middleware/permissionMiddleware.js');

// Enrollment records include scores. Keep them admin-only until a verified
// student-to-user link and row-level own-record access are implemented.
router.use(authMiddleware, requireRole('admin'));

router.get('/', requirePermission('enrollments.view'), getEnrollments);
router.get('/:id', requirePermission('enrollments.view'), getEnrollmentById);
router.post('/', requirePermission('enrollments.manage'), createEnrollment);
router.patch('/:id', requirePermission('enrollments.manage'), updateEnrollment);
router.delete('/:id', requirePermission('enrollments.manage'), deleteEnrollment);

module.exports = router;