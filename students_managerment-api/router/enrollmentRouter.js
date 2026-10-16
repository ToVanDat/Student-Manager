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

// Enrollment records include scores. Keep them admin-only until a verified
// student-to-user link and row-level own-record access are implemented.
router.use(authMiddleware, requireRole('admin'));

router.get('/', getEnrollments);
router.get('/:id', getEnrollmentById);
router.post('/', createEnrollment);
router.patch('/:id', updateEnrollment);
router.delete('/:id', deleteEnrollment);

module.exports = router;