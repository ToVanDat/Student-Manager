const express = require('express');

const {
    getSemesters,
    getSemesterById,
    createSemester,
    updateSemester,
    deleteSemester
} = require('../controller/semesters_controller.js');

const router = express.Router();

router.get('/', getSemesters);
router.get('/:id', getSemesterById);
router.post('/', createSemester);
router.patch('/:id', updateSemester);
router.delete('/:id', deleteSemester);

module.exports = router;