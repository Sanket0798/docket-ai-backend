const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect } = require('../middleware/auth');
const { saveQuestion, getQuestions } = require('../controllers/questions.controller');

router.get('/', protect, getQuestions);
router.post('/', protect, saveQuestion);

module.exports = router;
