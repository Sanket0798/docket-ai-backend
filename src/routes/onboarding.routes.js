const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getOnboarding,
  saveOnboarding,
} = require('../controllers/onboarding.controller');

router.get('/', protect, getOnboarding);
router.post('/', protect, saveOnboarding);

module.exports = router;
