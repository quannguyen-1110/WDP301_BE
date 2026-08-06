const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');

const {
  createAnnotation,
  getAnnotationsByPage,
  updateAnnotation,
  resolveAnnotation,
  deleteAnnotation,
} = require('../controllers/annotationController.js');

// Protect all routes
router.use(protect);

/**
 * Create annotation
 */
router.post('/', authorize('ADMIN', 'EDITOR', 'MANGAKA'), createAnnotation);

/**
 * Get annotations by page
 */
router.get('/page/:pageId', authorize('ADMIN', 'EDITOR', 'MANGAKA', 'ASSISTANT', 'BOARD_MEMBER'), getAnnotationsByPage);

/**
 * Update annotation
 */
router.put('/:id', authorize('ADMIN', 'EDITOR', 'MANGAKA'), updateAnnotation);

/**
 * Resolve or reopen annotation
 */
router.put('/:id/resolve', authorize('ADMIN', 'EDITOR', 'MANGAKA'), resolveAnnotation);

/**
 * Delete annotation
 */
router.delete('/:id', authorize('ADMIN', 'EDITOR', 'MANGAKA'), deleteAnnotation);

module.exports = router;