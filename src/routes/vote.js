const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');

const {
  submitVote,
  getMyVotes,
  updateVote,
  deleteVote,
  getVotesBySubmission
} = require('../controllers/voteController.js');

// Protect all routes
router.use(protect);

/**
 * Submit vote
 */
router.post('/', authorize('ADMIN', 'BOARD_MEMBER'), submitVote);

/**
 * Get my votes
 */
router.get('/me', authorize('ADMIN', 'BOARD_MEMBER'), getMyVotes);

/**
 * Get votes by submission
 */
router.get('/submission/:id', authorize('ADMIN', 'BOARD_MEMBER', 'EDITOR'), getVotesBySubmission);

/**
 * Update vote
 */
router.put('/:voteId', authorize('ADMIN', 'BOARD_MEMBER'), updateVote);

/**
 * Delete vote
 */
router.delete('/:voteId', authorize('ADMIN', 'BOARD_MEMBER'), deleteVote);

module.exports = router;