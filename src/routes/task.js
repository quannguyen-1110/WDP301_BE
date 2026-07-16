const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth.js');
const { protect } = require('../middleware/auth.js'); // Thêm protect nếu chưa có
const {
  createTask,
  submitTask,
  getMyTasks,
  reviewTask,
  getTaskById,
} = require('../controllers/taskController.js');

// Protect all routes
router.use(protect);

/**
 * Create Task - Cho phép ADMIN và MANGAKA
 */
router.post('/', authorize('ADMIN', 'MANGAKA'), createTask);

/**
 * Assistant submit task
 */
router.put('/:id/submit', authorize('ASSISTANT'), submitTask);

/**
 * Get tasks (thêm ADMIN)
 */
router.get(
  '/',
  authorize('ADMIN', 'MANGAKA', 'ASSISTANT', 'EDITOR', 'BOARD_MEMBER'),
  getMyTasks
);

/**
 * Get task by ID
 */
router.get(
  '/:id',
  authorize('ADMIN', 'MANGAKA', 'ASSISTANT', 'EDITOR', 'BOARD_MEMBER'),
  getTaskById
);

/**
 * Review task - Cho phép ADMIN và MANGAKA
 */
router.put('/:id/review', authorize('ADMIN', 'MANGAKA', 'EDITOR'), reviewTask);

module.exports = router;