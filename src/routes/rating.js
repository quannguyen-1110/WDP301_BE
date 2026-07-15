const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');

const {
  getSeriesRatings,
  submitRating,
  updateRating,
  deleteRating,
  getAllRatings
} = require('../controllers/ratingController.js');

// Protect all routes
router.use(protect);

/**
 * Submit rating
 */
router.post('/', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER'), submitRating);

/**
 * Update rating
 */
router.put('/:ratingId', authorize('ADMIN', 'EDITOR'), updateRating);

/**
 * Delete rating
 */
router.delete('/:ratingId', authorize('ADMIN', 'EDITOR'), deleteRating);

/**
 * Get ratings by series
 */
router.get('/:seriesId', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA'), getSeriesRatings);

/**
 * Get all ratings
 */
router.get('/', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA'), getAllRatings);

module.exports = router;