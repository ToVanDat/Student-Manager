const express = require('express');

const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const requireRole = require('../middleware/roleMiddleware.js');
const requirePermission = require('../middleware/permissionMiddleware.js');
const { validateResourceId, validateObjectBody } = require('../middleware/catalogRequestValidation.js');

router.use(authMiddleware);

const subjectController =
    require('../controller/subject_controller.js');


// GET tất cả môn học
router.get('/', requirePermission('subjects.view'), subjectController.getSubjects);


// GET môn học theo ID
router.get('/:id', requirePermission('subjects.view'), validateResourceId, subjectController.getSubjectById);


// POST thêm môn học
router.post('/', requireRole('admin'), requirePermission('subjects.manage'), validateObjectBody(), subjectController.createSubject);


// PATCH cập nhật môn học
router.patch('/:id', requireRole('admin'), requirePermission('subjects.manage'), validateResourceId, validateObjectBody({ partial: true }), subjectController.updateSubject);


// DELETE xóa môn học
router.delete('/:id', requireRole('admin'), requirePermission('subjects.manage'), validateResourceId, subjectController.deleteSubject);


module.exports = router;