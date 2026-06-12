const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth.js');

router.use(protect);

const {
  getAllChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  publishChapter,
} = require('../controllers/chapterController.js');
/**
 * @swagger
 * /api/chapters:
 *   get:
 *     summary: Get all chapters, filter by ?seriesId= (Editor, Board Member)
 *     tags: [Chapters]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: seriesId
 *         schema:
 *           type: string
 *         description: Filter by series ID
 *     responses:
 *       200:
 *         description: List of chapters returned
 *       500:
 *         description: Server error
 */
router.get('/', authorize('EDITOR', 'BOARD_MEMBER'), getAllChapters);

/**
 * @swagger
 * /api/chapters:
 *   post:
 *     summary: Create a new chapter (Editor)
 *     tags: [Chapters]
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
 *             properties:
 *               seriesId:
 *                 type: string
 *                 example: 665series123...
 *               chapterNumber:
 *                 type: number
 *                 example: 5
 *               dueAt:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-06-15T00:00:00Z
 *     responses:
 *       201:
 *         description: Chapter created successfully
 *       500:
 *         description: Server error
 */
router.post('/', authorize('MANGAKA', 'EDITOR'), createChapter);

/**
 * @swagger
 * /api/chapters/{id}:
 *   delete:
 *     summary: Delete a chapter (Mangaka)
 *     tags: [Chapters]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The chapter ID
 *     responses:
 *       200:
 *         description: Chapter deleted successfully
 *       500:
 *         description: Server error
 */
router.delete('/:id', authorize('MANGAKA'), deleteChapter);

/**
 * @swagger
 * /api/chapters/{id}:
 *   put:
 *     summary: Update a chapter (Mangaka or Editor)
 *     tags: [Chapters]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The chapter ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chapterNumber:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [IN_PROGRESS, COMPLETED]
 *               dueAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Chapter updated successfully
 *       500:
 *         description: Server error
 */
router.put('/:id', authorize('MANGAKA', 'EDITOR'), updateChapter);

/**
 * @swagger
 * /api/chapters/publish/{id}:
 *   post:
 *     summary: Publish a chapter (Mangaka)
 *     tags: [Chapters]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The chapter ID
 *     responses:
 *       200:
 *         description: Chapter published successfully
 *       500:
 *         description: Server error
 */
router.post('/publish/:id', authorize('MANGAKA'), publishChapter);

module.exports = router;