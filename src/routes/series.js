const express = require('express');
const router = express.Router();
const {
  createSeries,
  getAllSeries,
  getSeriesById,
  reviewSeries,
  updateSeriesStatus,
} = require('../controllers/seriesController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/series:
 *   post:
 *     summary: Create a new series proposal (MANGAKA only)
 *     tags: [Series]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Shadow Blade Saga
 *               synopsis:
 *                 type: string
 *                 example: A blind swordsman who can see through shadows fights to protect a hidden village.
 *     responses:
 *       201:
 *         description: Proposal created successfully
 *       403:
 *         description: Forbidden - Only MANGAKA can access this route
 */
router.post('/', authorize('MANGAKA'), createSeries);

/**
 * @swagger
 * /api/series:
 *   get:
 *     summary: Get all series proposals (intelligent filtering based on roles)
 *     tags: [Series]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, IN_PRODUCTION, PUBLISHED, REJECTED, CANCELLED]
 *         description: Filter series by status
 *     responses:
 *       200:
 *         description: Return list of series proposals
 */
router.get('/', getAllSeries);

/**
 * @swagger
 * /api/series/{id}:
 *   get:
 *     summary: Get detailed view of a series proposal by ID
 *     tags: [Series]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The series ID
 *     responses:
 *       200:
 *         description: Series details retrieved
 *       404:
 *         description: Series not found
 */
router.get('/:id', getSeriesById);

/**
 * @swagger
 * /api/series/{id}/review:
 *   put:
 *     summary: Approve or reject a series proposal (EDITOR only)
 *     tags: [Series]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The series ID to review
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 example: APPROVED
 *               note:
 *                 type: string
 *                 example: "Excellent pacing, suitable for weekly!"
 *               pubSchedule:
 *                 type: string
 *                 enum: [WEEKLY, MONTHLY]
 *                 example: WEEKLY
 *     responses:
 *       200:
 *         description: Series reviewed and updated successfully
 *       403:
 *         description: Forbidden - Only EDITOR can access this route
 */
router.put('/:id/review', authorize('EDITOR'), reviewSeries);

/**
 * @swagger
 * /api/series/{id}/status:
 *   put:
 *     summary: Transition series to next production state (EDITOR or BOARD only)
 *     tags: [Series]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The series ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, IN_PRODUCTION, PUBLISHED, CANCELLED]
 *                 example: IN_PRODUCTION
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid state transition
 */
router.put('/:id/status', authorize('EDITOR', 'BOARD_MEMBER'), updateSeriesStatus);

module.exports = router;
