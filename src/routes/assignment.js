const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');

const {
  createAssignment,
  getAssignments,
  getMyAssignments,
  updateAssignmentStatus,
} = require('../controllers/assignmentController.js');

// Protect all routes
router.use(protect);

/**
 * Mangaka tạo assignment (mời assistant)
 */
router.post('/', authorize('ADMIN', 'MANGAKA'), createAssignment);

/**
 * Lấy danh sách assignment (xem)
 */
router.get('/', authorize('ADMIN', 'MANGAKA', 'ASSISTANT', 'EDITOR', 'BOARD_MEMBER'), getAssignments);

/**
 * Lấy assignment của assistant hiện tại
 */
router.get('/my', authorize('ADMIN', 'ASSISTANT'), getMyAssignments);

/**
 * Cập nhật trạng thái assignment
 */
router.put('/:id/status', authorize('ADMIN', 'MANGAKA', 'ASSISTANT'), updateAssignmentStatus);

module.exports = router;
