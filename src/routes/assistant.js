const express = require('express');
const router = express.Router();
const {
  getMyTasks,
  getTaskPages,
  uploadPageResult,
  submitTask,
  getEarnings,
  getEarningDetail,
  getStats,
} = require('../controllers/assistantController.js');

/**
 * @swagger
 * /api/assistant/my-tasks:
 *   get:
 *     summary: View list of assigned tasks for current Assistant
 *     tags: [Assistant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned tasks returned successfully
 *       500:
 *         description: Server error
 */
router.get('/my-tasks', getMyTasks);

/**
 * @swagger
 * /api/assistant/tasks/{taskId}/pages:
 *   get:
 *     summary: Get pages & resources for a specific task
 *     tags: [Assistant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task pages and details returned successfully
 *       404:
 *         description: Task not found
 */
router.get('/tasks/:taskId/pages', getTaskPages);

/**
 * @swagger
 * /api/assistant/pages/{pageId}/upload:
 *   put:
 *     summary: Upload processed page artwork (result)
 *     tags: [Assistant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assistantImageUrl
 *             properties:
 *               assistantImageUrl:
 *                 type: string
 *                 example: https://res.cloudinary.com/demo/image/upload/v1234/page5_done.png
 *               note:
 *                 type: string
 *                 example: Added tone and finalized background inks.
 *     responses:
 *       200:
 *         description: Page artwork uploaded successfully
 *       404:
 *         description: Page or task not found
 */
router.put('/pages/:pageId/upload', uploadPageResult);

/**
 * @swagger
 * /api/assistant/tasks/{taskId}/submit:
 *   put:
 *     summary: Submit a task for review
 *     tags: [Assistant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task submitted successfully
 *       404:
 *         description: Task not found
 */
router.put('/tasks/:taskId/submit', submitTask);

/**
 * @swagger
 * /api/assistant/earnings:
 *   get:
 *     summary: View overall earnings and history
 *     tags: [Assistant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: "2026-06"
 *         description: Filter by month in YYYY-MM format
 *     responses:
 *       200:
 *         description: Earnings list retrieved successfully
 */
router.get('/earnings', getEarnings);

/**
 * @swagger
 * /api/assistant/earnings/{month}:
 *   get:
 *     summary: View details of earnings for a specific month
 *     tags: [Assistant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026-06"
 *     responses:
 *       200:
 *         description: Month earnings detail retrieved successfully
 *       404:
 *         description: Earning not found for month
 */
router.get('/earnings/:month', getEarningDetail);

/**
 * @swagger
 * /api/assistant/stats:
 *   get:
 *     summary: View overall stats summary (earnings, page count, tasks status)
 *     tags: [Assistant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Stats summary retrieved successfully
 */
router.get('/stats', getStats);

module.exports = router;
