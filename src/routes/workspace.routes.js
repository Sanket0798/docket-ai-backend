const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getWorkspaces,
  createWorkspace,
  deleteWorkspace,
} = require('../controllers/workspace.controller');

router.get('/', protect, getWorkspaces);
router.post('/', protect, createWorkspace);
router.delete('/:id', protect, deleteWorkspace);

module.exports = router;
