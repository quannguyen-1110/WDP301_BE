const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const {
  createProposal,
  getProposals,
  downloadStoryboard,
  forwardProposal,
  rejectProposal,
} = require('../controllers/proposalController');

// Protect all routes
router.use(protect);

/**
 * Mangaka tạo proposal
 */
router.post('/', authorize('MANGAKA'), upload.single('storyboard'), createProposal);

/**
 * Xem danh sách proposal (ADMIN + EDITOR)
 */
router.get('/', authorize('ADMIN', 'EDITOR'), getProposals);

/**
 * Download storyboard
 */
router.get('/:id/storyboard', authorize('ADMIN', 'EDITOR'), downloadStoryboard);

/**
 * Forward proposal to Board
 */
router.put('/:id/forward', authorize('ADMIN', 'EDITOR'), forwardProposal);

/**
 * Reject proposal
 */
router.put('/:id/reject', authorize('ADMIN', 'EDITOR'), rejectProposal);

module.exports = router;