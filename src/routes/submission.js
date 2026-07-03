const express = require('express');
const router = express.Router();
const { protect, authorize } = require("../middleware/auth.js");

const {
  createSubmission,
  updateSubmission,
  deleteSubmission,
  getSubmissionById,
  getVotesBySubmissionId,
  assignVoters,
  getVotingStatus,
  getAllSubmissionsByProposal,
  getAllSubmissionsBySeriesId,
} = require('../controllers/submissionController.js');

// Protect all routes
router.use(protect);

/**
 * Create submission
 */
router.post('/', authorize('ADMIN', 'MANGAKA'), createSubmission);

/**
 * Get all submissions by Proposal status(ADMIN + BOARD)
 */
router.get('/all', authorize('ADMIN', 'BOARD_MEMBER', 'EDITOR'), getAllSubmissionsByProposal);

/**
 * Get all submissions by series ID
 */
router.get('/series/:seriesId', authorize('ADMIN', 'BOARD_MEMBER', 'EDITOR'), getAllSubmissionsBySeriesId);

/**
 * Assign voters
 */
router.post('/:submissionId/voters', authorize('ADMIN', 'BOARD_MEMBER'), assignVoters);

/**
 * Get voting status
 */
router.get('/:submissionId/voters', authorize('ADMIN', 'BOARD_MEMBER', 'MANGAKA'), getVotingStatus);

/**
 * Get submission by ID
 */
router.get('/:submissionId', authorize('ADMIN', 'BOARD_MEMBER', 'MANGAKA'), getSubmissionById);

/**
 * Get votes
 */
router.get('/:submissionId/votes', authorize('ADMIN', 'BOARD_MEMBER', 'MANGAKA'), getVotesBySubmissionId);

/**
 * Update submission
 */
router.put('/:submissionId', authorize('ADMIN', 'MANGAKA'), updateSubmission);

/**
 * Delete submission
 */
router.delete('/:submissionId', authorize('ADMIN', 'MANGAKA'), deleteSubmission);

module.exports = router;