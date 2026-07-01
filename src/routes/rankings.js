const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');

const {
  getRankings,
  updateScores,
  applyDirective,
} = require('../controllers/rankingsController.js');

// Protect all routes
router.use(protect);

/**
 * Get rankings
 */
router.get('/', authorize('ADMIN', 'BOARD_MEMBER', 'MANGAKA', 'EDITOR'), getRankings);

/**
 * Update scores
 */
router.put('/scores', authorize('ADMIN', 'BOARD_MEMBER'), updateScores);

/**
 * Apply directive
 */
router.post('/directive', authorize('ADMIN', 'BOARD_MEMBER'), applyDirective);

module.exports = router;