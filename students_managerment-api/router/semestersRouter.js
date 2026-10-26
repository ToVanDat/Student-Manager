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
const requirePermission = require('../middleware/permissionMiddleware.js');
const { validateResourceId, validateObjectBody } = require('../middleware/catalogRequestValidation.js');

router.use(authMiddleware);

router.get('/', requirePermission('semesters.view'), getSemesters);
router.get('/:id', requirePermission('semesters.view'), validateResourceId, getSemesterById);
router.post('/', requireRole('admin'), requirePermission('semesters.manage'), validateObjectBody(), createSemester);
router.patch('/:id', requireRole('admin'), requirePermission('semesters.manage'), validateResourceId, validateObjectBody({ partial: true }), updateSemester);
router.delete('/:id', requireRole('admin'), requirePermission('semesters.manage'), validateResourceId, deleteSemester);

module.exports = router;