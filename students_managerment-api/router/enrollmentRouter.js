const express = require('express');

const {
    getEnrollments,
    getEnrollmentById,
    createEnrollment,
    updateEnrollment,
    deleteEnrollment
} = require('../controller/enrollment_controller.js');

const router = express.Router();

router.get('/', getEnrollments);
router.get('/:id', getEnrollmentById);
router.post('/', createEnrollment);
router.patch('/:id', updateEnrollment);
router.delete('/:id', deleteEnrollment);

module.exports = router;