const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getPublications,
  openPublication,
  votePublication,
  tieBreakPublication,
} = require('../controllers/boardController');

const router = express.Router();

router.use(protect, authorize('ADMIN', 'BOARD_MEMBER'));
router.get('/publications', getPublications);
router.post('/publications/:chapterId/open', openPublication);
router.post('/publications/:sessionId/vote', votePublication);
router.post('/publications/:sessionId/tie-break', tieBreakPublication);

module.exports = router;
