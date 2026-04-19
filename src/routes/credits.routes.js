const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPlans,
  getCreditUsage,
  getCreditHistory,
  createOrder,
  verifyPayment,
  getPaymentHistory,
  handleWebhook,
} = require('../controllers/credits.controller');

router.get('/plans', getPlans);
router.get('/usage', protect, getCreditUsage);
router.get('/history', protect, getCreditHistory);
router.post('/order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.get('/payments', protect, getPaymentHistory);

// Razorpay webhook — no auth, Razorpay calls this directly
// Raw body is needed for signature verification (set in server.js)
router.post('/webhook', handleWebhook);

module.exports = router;
