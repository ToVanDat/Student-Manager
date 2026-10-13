const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const uploadAvatarFile = require('../middleware/avatarUploadMiddleware');
const avatarController = require('../controller/avatarController');

const router = express.Router();
router.use(authMiddleware);
router.post('/', uploadAvatarFile, avatarController.uploadAvatar);

module.exports = router;
