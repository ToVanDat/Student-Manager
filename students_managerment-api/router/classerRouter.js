const express = require('express');

const {
    getClasses,
    getClassById,
    createClass,
    updateClass,
    deleteClass
} = require('../controller/classer_controller.js');

const router = express.Router();


// GET /api/classes
router.get('/', getClasses);

// GET /api/classes/:id
router.get('/:id', getClassById);

// POST /api/classes
router.post('/', createClass);

// PATCH /api/classes/:id
router.patch('/:id', updateClass);

// DELETE /api/classes/:id
router.delete('/:id', deleteClass);

module.exports = router;