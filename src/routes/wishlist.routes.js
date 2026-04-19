const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  useWishlistItem,
} = require('../controllers/wishlist.controller');

router.get('/', protect, getWishlist);
router.post('/', protect, addToWishlist);
router.delete('/:id', protect, removeFromWishlist);
router.post('/:id/use', protect, useWishlistItem);

module.exports = router;
