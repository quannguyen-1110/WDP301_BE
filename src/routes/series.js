const express = require('express');
const router = express.Router();
const {
  createSeries,
  getAllSeries,
  getSeriesById,
  reviewSeries,
  updateSeriesStatus,
} = require('../controllers/seriesController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

/**
 * Mangaka tạo series
 */
router.post('/', authorize('MANGAKA'), createSeries);

/**
 * Lấy danh sách series (ADMIN, EDITOR, MANGAKA)
 */
router.get('/', authorize('ADMIN', 'EDITOR', 'MANGAKA'), getAllSeries);

/**
 * Lấy chi tiết series
 */
router.get('/:id', authorize('ADMIN', 'EDITOR', 'MANGAKA'), getSeriesById);

/**
 * Review series (ADMIN + EDITOR + BOARD_MEMBER)
 */
router.put('/:id/review', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER'), reviewSeries);

/**
 * Update series status
 */
router.put('/:id/status', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER'), updateSeriesStatus);

module.exports = router;