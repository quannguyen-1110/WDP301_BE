const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const {
  createProposal,
  getProposals,
  getProposalById,
  downloadStoryboard,
  addComment,
  requestRevision,
  forwardProposal,
  rejectProposal,
  sendToBoard,
  approveProposal,
  resubmitProposal,
} = require('../controllers/proposalController');

// Protect all routes
router.use(protect);

/**
 * Mangaka tạo proposal
 */
router.post('/', authorize('MANGAKA'), upload.single('storyboard'), createProposal);

/**
 * Get proposals (ADMIN, EDITOR, MANGAKA, BOARD_MEMBER)
 */
router.get('/', authorize('ADMIN', 'EDITOR', 'MANGAKA', 'BOARD_MEMBER'), getProposals);

/**
 * Get proposal by ID
 */
router.get('/:id', authorize('ADMIN', 'EDITOR', 'MANGAKA', 'BOARD_MEMBER'), getProposalById);

/**
 * Download storyboard
 */
router.get('/:id/storyboard', authorize('ADMIN', 'EDITOR'), downloadStoryboard);

/**
 * Add review comment to proposal
 */
router.put('/:id/comment', authorize('ADMIN', 'EDITOR', 'MANGAKA', 'BOARD_MEMBER'), addComment);

/**
 * Request revision
 */
router.put('/:id/revision', authorize('ADMIN', 'EDITOR'), requestRevision);

/**
 * Resubmit proposal after revision
 */
router.put('/:id/resubmit', authorize('MANGAKA'), resubmitProposal);

/**
 * Forward proposal to Board
 */
router.put('/:id/forward', authorize('ADMIN', 'EDITOR'), forwardProposal);

/**
 * Send proposal to Editorial Board
 */
router.put('/:id/send-to-board', authorize('ADMIN', 'EDITOR'), sendToBoard);

/**
 * Approve proposal
 */
router.put('/:id/approve', authorize('ADMIN', 'BOARD_MEMBER'), approveProposal);

/**
 * Reject proposal
 */
router.put('/:id/reject', authorize('ADMIN', 'EDITOR'), rejectProposal);

module.exports = router;