const express = require('express');

const router = express.Router();

const subjectController =
    require('../controller/subject_controller.js');


// GET tất cả môn học
router.get('/', subjectController.getSubjects);


// GET môn học theo ID
router.get('/:id', subjectController.getSubjectById);


// POST thêm môn học
router.post('/', subjectController.createSubject);


// PATCH cập nhật môn học
router.patch('/:id', subjectController.updateSubject);


// DELETE xóa môn học
router.delete('/:id', subjectController.deleteSubject);


module.exports = router;