const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createNotification,
  getNotifications,
  getUnreadNotifications,
  markAsRead,
  markAsReadAll,
  getAllNotifications,     // ← Mới
  deleteNotification       // ← Mới
} = require("../controllers/notifcationController");

// Protect all routes
router.use(protect);

/**
 * Get all notifications for a user
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
 * === ADMIN ONLY ===
 * Get ALL notifications in system
 */
router.get('/', authorize('ADMIN'), getAllNotifications);

/**
 * === ADMIN ONLY ===
 * Delete a notification
 */
router.delete('/:id', authorize('ADMIN'), deleteNotification);

/**
 * Create notification
 */
router.post("/", authorize("ADMIN", "EDITOR", "BOARD_MEMBER"), createNotification);

module.exports = router;