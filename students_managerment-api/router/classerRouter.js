const express = require('express');

const {
    getClasses,
    getClassById,
    createClass,
    updateClass,
    deleteClass
} = require('../controller/classer_controller.js');

const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const requireRole = require('../middleware/roleMiddleware.js');
const { validateResourceId, validateObjectBody } = require('../middleware/catalogRequestValidation.js');

router.use(authMiddleware);


// GET /api/classes
router.get('/', getClasses);

// GET /api/classes/:id
router.get('/:id', validateResourceId, getClassById);

// POST /api/classes
router.post('/', requireRole('admin'), validateObjectBody(), createClass);

// PATCH /api/classes/:id
router.patch('/:id', requireRole('admin'), validateResourceId, validateObjectBody({ partial: true }), updateClass);

// DELETE /api/classes/:id
router.delete('/:id', requireRole('admin'), validateResourceId, deleteClass);

module.exports = router;