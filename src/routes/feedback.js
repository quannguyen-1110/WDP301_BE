const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');

const {
  createFeedback,
  getChapterFeedback,
  updateFeedback,
  deleteFeedback,
} = require('../controllers/feedbackController.js');

// Protect all routes
router.use(protect);

/**
 * Editor gửi feedback
 */
router.post('/', authorize('ADMIN', 'EDITOR'), createFeedback);

/**
 * Xem lịch sử feedback của chapter (tất cả roles có quyền truy cập chapter)
 */
router.get('/chapter/:chapterId', authorize('ADMIN', 'EDITOR', 'MANGAKA', 'ASSISTANT', 'BOARD_MEMBER'), getChapterFeedback);

/**
 * Cập nhật feedback
 */
router.put('/:id', authorize('ADMIN', 'EDITOR', 'MANGAKA'), updateFeedback);

/**
 * Xóa feedback
 */
router.delete('/:id', authorize('ADMIN', 'EDITOR'), deleteFeedback);

module.exports = router;
