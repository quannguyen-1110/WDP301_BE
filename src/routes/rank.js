const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth.js');
const { getSeriesRanks, submitRank, updateRank, deleteRank } = require('../controllers/rankController.js');

/**
 * @swagger
 * /api/ranks:
 *   post:
 *     summary: Submit a rank entry for a series (Board Member)
 *     tags: [Ranks]
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
 *               - rank
 *             properties:
 *               seriesId:
 *                 type: string
 *                 example: 665series123...
 *               rank:
 *                 type: number
 *                 example: 1
 *               prevRank:
 *                 type: number
 *                 example: 3
 *               rankedOn:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-05-28T00:00:00Z
 *     responses:
 *       201:
 *         description: Rank created successfully
 *       500:
 *         description: Server error
 */
router.post('/', authorize('BOARD_MEMBER'), submitRank);

/**
 * @swagger
 * /api/ranks/{seriesId}:
 *   get:
 *     summary: Get the latest rank for a series
 *     tags: [Ranks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: seriesId
 *         required: true
 *         schema:
 *           type: string
 *         description: The series ID
 *     responses:
 *       200:
 *         description: Latest rank returned
 *       500:
 *         description: Server error
 */
router.get('/:seriesId', getSeriesRanks);

/**
 * @swagger
 * /api/ranks/{id}:
 *   put:
 *     summary: Update a rank by ID (Board Member)
 *     tags: [Ranks]
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
 *         description: Latest rank returned
 *       500:
 *         description: Server error
 */
router.put('/:id', authorize('BOARD_MEMBER'), updateRank);

/**
 * @swagger
 * /api/ranks/{id}:
 *   delete:
 *     summary: Delete a rank by ID (Board Member)
 *     tags: [Ranks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The rank ID
 *     responses:
 *       200:
 *         description: Rank deleted
 *       500:
 *         description: Server error
 */
router.delete('/:id', authorize('BOARD_MEMBER'), deleteRank);

module.exports = router;