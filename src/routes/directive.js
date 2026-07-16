const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getDirectives,
  createDirective,
  voteDirective,
} = require('../controllers/directiveController');

const router = express.Router();
router.use(protect, authorize('ADMIN', 'BOARD_MEMBER'));
router.get('/', getDirectives);
router.post('/', createDirective);
router.post('/:directiveId/vote', voteDirective);

module.exports = router;
