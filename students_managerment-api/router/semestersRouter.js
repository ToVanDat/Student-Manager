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

router.use(authMiddleware);

router.get('/', getSemesters);
router.get('/:id', getSemesterById);
router.post('/', requireRole('admin'), createSemester);
router.patch('/:id', requireRole('admin'), updateSemester);
router.delete('/:id', requireRole('admin'), deleteSemester);

module.exports = router;