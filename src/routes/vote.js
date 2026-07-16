const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

const {
  submitVote,
  tieBreakProposal,
  getMyVotes,
  updateVote,
  deleteVote,
  getVotesBySubmission,
} = require('../controllers/voteController');

router.use(protect);

router.post('/', authorize('ADMIN', 'BOARD_MEMBER'), submitVote);
router.post('/submission/:id/tie-break', authorize('ADMIN', 'BOARD_MEMBER'), tieBreakProposal);
router.get('/me', authorize('ADMIN', 'BOARD_MEMBER'), getMyVotes);
router.get('/submission/:id', authorize('ADMIN', 'BOARD_MEMBER', 'EDITOR'), getVotesBySubmission);
router.put('/:voteId', authorize('ADMIN'), updateVote);
router.delete('/:voteId', authorize('ADMIN'), deleteVote);

module.exports = router;
