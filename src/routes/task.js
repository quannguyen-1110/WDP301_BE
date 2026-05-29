const express = require('express');
const router = express.Router();
const {
  createTask,
  submitTask,
  getMyTasks
} = require('../controllers/taskController.js');

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task assignment
 *     tags: [Tasks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - seriesId
 *               - assignedTo
 *               - title
 *             properties:
 *               seriesId:
 *                 type: string
 *                 example: 665abc123...
 *               chapterId:
 *                 type: string
 *                 example: 665def456...
 *               assignedTo:
 *                 type: string
 *                 example: 665user789...
 *               title:
 *                 type: string
 *                 example: Draw chapter 5 - Action scene
 *     responses:
 *       201:
 *         description: Task created successfully
 *       500:
 *         description: Server error
 */
router.post('/', createTask);

/**
 * @swagger
 * /api/tasks/{id}/submit:
 *   put:
 *     summary: Mark a task as done
 *     tags: [Tasks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     responses:
 *       200:
 *         description: Task marked as done
 *       404:
 *         description: Task not found
 */
router.put('/:id/submit', submitTask);

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks assigned to a user
 *     tags: [Tasks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID to filter tasks
 *     responses:
 *       200:
 *         description: List of tasks returned
 *       500:
 *         description: Server error
 */
router.get('/', getMyTasks);

module.exports = router;