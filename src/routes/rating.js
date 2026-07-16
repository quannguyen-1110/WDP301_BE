const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

const {
  getSeriesRatings,
  submitRating,
  importRatings,
  updateRating,
  deleteRating,
  getAllRatings,
} = require('../controllers/ratingController');

router.use(protect);

router.post('/', authorize('ADMIN', 'BOARD_MEMBER'), submitRating);
router.post('/import', authorize('ADMIN', 'BOARD_MEMBER'), importRatings);
router.put('/:ratingId', authorize('ADMIN', 'BOARD_MEMBER'), updateRating);
router.delete('/:ratingId', authorize('ADMIN', 'BOARD_MEMBER'), deleteRating);
router.get('/:seriesId', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA'), getSeriesRatings);
router.get('/', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA'), getAllRatings);

module.exports = router;
