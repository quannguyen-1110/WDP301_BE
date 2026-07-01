const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createNotification,
  getNotifications,
  getUnreadNotifications,
  markAsRead,
  markAsReadAll,
} = require("../controllers/notifcationController");

// Protect all routes
router.use(protect);

/**
 * Get all notifications for a user (ADMIN có thể xem của user khác)
 */
router.get("/:userId", authorize('ADMIN', 'MANGAKA', 'ASSISTANT', 'EDITOR', 'BOARD_MEMBER'), getNotifications);

/**
 * Get unread notifications
 */
router.get("/:userId/unread", authorize('ADMIN', 'MANGAKA', 'ASSISTANT', 'EDITOR', 'BOARD_MEMBER'), getUnreadNotifications);

/**
 * Mark all as read
 */
router.patch("/:userId/read-all", authorize('ADMIN', 'MANGAKA', 'ASSISTANT', 'EDITOR', 'BOARD_MEMBER'), markAsReadAll);

/**
 * Mark single notification as read
 */
router.patch("/:id/read", authorize('ADMIN', 'MANGAKA', 'ASSISTANT', 'EDITOR', 'BOARD_MEMBER'), markAsRead);

/**
 * Create notification (ADMIN + EDITOR + BOARD_MEMBER)
 */
router.post("/", authorize("ADMIN", "EDITOR", "BOARD_MEMBER"), createNotification);

module.exports = router;