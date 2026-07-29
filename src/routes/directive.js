const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getDirectives,
  createDirective,
  voteDirective,
  tieBreakDirective,
} = require('../controllers/directiveController');

const router = express.Router();
router.use(protect, authorize('ADMIN', 'BOARD_MEMBER'));
router.get('/', getDirectives);
router.post('/', createDirective);
router.post('/:directiveId/vote', voteDirective);
router.post('/:directiveId/tie-break', tieBreakDirective);

module.exports = router;
