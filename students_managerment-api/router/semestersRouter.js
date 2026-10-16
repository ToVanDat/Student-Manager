const express = require('express');

const {
    getSemesters,
    getSemesterById,
    createSemester,
    updateSemester,
    deleteSemester
} = require('../controller/semesters_controller.js');

const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const requireRole = require('../middleware/roleMiddleware.js');
const { validateResourceId, validateObjectBody } = require('../middleware/catalogRequestValidation.js');

router.use(authMiddleware);

router.get('/', getSemesters);
router.get('/:id', validateResourceId, getSemesterById);
router.post('/', requireRole('admin'), validateObjectBody(), createSemester);
router.patch('/:id', requireRole('admin'), validateResourceId, validateObjectBody({ partial: true }), updateSemester);
router.delete('/:id', requireRole('admin'), validateResourceId, deleteSemester);

module.exports = router;