const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, uploadAvatar, removeAvatar, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { uploadAvatarImage } = require('../middleware/uploadMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);

// Profile management
router.put('/profile', protect, updateProfile);

// Avatar (profile photo) management
router.post('/avatar', protect, uploadAvatarImage.single('avatar'), uploadAvatar);
router.delete('/avatar', protect, removeAvatar);

module.exports = router;

