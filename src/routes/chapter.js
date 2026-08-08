const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');

const {
  getAllChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  publishChapter,
  submitPageToEditor,
  getChapterById,
} = require('../controllers/chapterController.js');

const {
  createFeedback,
  getChapterFeedback,
  assignFeedback,
  approveFeedback,
} = require('../controllers/feedbackController.js');

// Protect all routes
router.use(protect);

/**
 * Get all chapters
 */
router.get('/', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA', 'ASSISTANT'), getAllChapters);

router.get('/:id', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA', 'ASSISTANT'), getChapterById);

/**
 * Create chapter
 */
router.post('/', authorize('ADMIN', 'MANGAKA'), createChapter);

/**
 * Update chapter
 */
router.put('/:id', authorize('ADMIN', 'MANGAKA', 'EDITOR'), updateChapter);

router.post(
  '/:id/submit-page',
  authorize('ADMIN', 'MANGAKA'),
  submitPageToEditor,
);

/**
 * Submit a page to the editor (no task required)
 */
router.post('/:id/submit-page', authorize('ADMIN', 'MANGAKA'), submitPageToEditor);

/**
 * Delete chapter
 */
router.delete('/:id', authorize('ADMIN', 'MANGAKA'), deleteChapter);

/**
 * Publish chapter
 */
router.post('/publish/:id', authorize('ADMIN', 'MANGAKA'), publishChapter);

/**
 * ===== FEEDBACK ENDPOINTS (Editor -> Mangaka -> Assistant) =====
 */

/** Editor gửi feedback cho chapter (có thể gửi nhiều lần) */
router.post('/:id/feedback', authorize('ADMIN', 'EDITOR'), createFeedback);

/** Xem lịch sử feedback của chapter */
router.get('/:id/feedback', authorize('ADMIN', 'EDITOR', 'MANGAKA', 'BOARD_MEMBER', 'ASSISTANT'), getChapterFeedback);

/** Mangaka giao task cho assistant để xử lý feedback */
router.put('/:id/feedback/assign', authorize('ADMIN', 'MANGAKA'), assignFeedback);

/** Editor approve/reject feedback */
router.put('/:id/feedback/approve', authorize('ADMIN', 'EDITOR'), approveFeedback);

module.exports = router;
