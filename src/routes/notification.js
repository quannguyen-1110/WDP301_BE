const express = require("express");
const router = express.Router();
const {
  createNotification,
  getNotifications,
  getUnreadNotifications,
  markAsRead,
  markAsReadAll,
} = require("../controllers/notifcationController");

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         title:
 *           type: string
 *         content:
 *           type: string
 *         type:
 *           type: string
 *           enum: [INFO, WARNING, ERROR]
 *         isRead:
 *           type: boolean
 *           default: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/notifications/{userId}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get all notifications for a user
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       400:
 *         description: User ID is required
 *       500:
 *         description: Server error
 */
router.get("/:userId", getNotifications);

/**
 * @swagger
 * /api/notifications/{userId}/unread:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notifications for a user
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of unread notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       400:
 *         description: User ID is required
 *       500:
 *         description: Server error
 */
router.get("/:userId/unread", getUnreadNotifications);

/**
 * @swagger
 * /api/notifications/{userId}/mark-all:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read for a user
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       500:
 *         description: Server error
 */
router.patch("/:userId/read-all", markAsReadAll);

/**
 * @swagger
 * /api/notifications/{id}/mark:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       500:
 *         description: Server error
 */
router.patch("/:id/read", markAsRead);

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     tags: [Notifications]
 *     summary: Create a new notification (EDITOR, BOARD_MEMBER only)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - title
 *               - content
 *               - type
 *             properties:
 *               userId:
 *                 type: string
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [INFO, WARNING, ERROR]
 *     responses:
 *       201:
 *         description: Notification created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       500:
 *         description: Server error
 */
router.post("/", authorize("EDITOR", "BOARD_MEMBER"), createNotification);

module.exports = router;