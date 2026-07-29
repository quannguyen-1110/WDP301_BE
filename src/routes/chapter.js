const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');

const {
  getAllChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  publishChapter,
  getChapterById,
} = require('../controllers/chapterController.js');

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
router.post('/', authorize('ADMIN', 'MANGAKA', 'EDITOR'), createChapter);

/**
 * Update chapter
 */
router.put('/:id', authorize('ADMIN', 'MANGAKA', 'EDITOR'), updateChapter);

/**
 * Delete chapter
 */
router.delete('/:id', authorize('ADMIN', 'MANGAKA'), deleteChapter);

/**
 * Publish chapter
 */
router.post('/publish/:id', authorize('ADMIN', 'MANGAKA'), publishChapter);

module.exports = router;