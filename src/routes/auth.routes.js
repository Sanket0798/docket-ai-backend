const express = require('express');
const router = express.Router();
const {
  register,
  login,
  verifyEmailOTP,
  resendOTP,
  getMe,
  forgotPassword,
  resetPassword,
  logout,
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmailOTP);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
