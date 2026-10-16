const express = require('express');

const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const requireRole = require('../middleware/roleMiddleware.js');

router.use(authMiddleware);

const subjectController =
    require('../controller/subject_controller.js');


// GET tất cả môn học
router.get('/', subjectController.getSubjects);


// GET môn học theo ID
router.get('/:id', subjectController.getSubjectById);


// POST thêm môn học
router.post('/', requireRole('admin'), subjectController.createSubject);


// PATCH cập nhật môn học
router.patch('/:id', requireRole('admin'), subjectController.updateSubject);


// DELETE xóa môn học
router.delete('/:id', requireRole('admin'), subjectController.deleteSubject);


module.exports = router;