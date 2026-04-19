const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { getProfile, updateProfile, uploadAvatar } = require('../controllers/profile.controller');

// Avatar upload uses memory storage — buffer is piped to Cloudinary upload_stream
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, or WebP images are allowed for avatars'));
  },
});

router.get('/',       protect, getProfile);
router.put('/',       protect, updateProfile);
router.post('/avatar', protect, avatarUpload.single('avatar'), uploadAvatar);

module.exports = router;
