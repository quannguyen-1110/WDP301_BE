const express = require('express');
const router = express.Router();
const { getSeriesRanks, submitRank } = require('../controllers/rankController.js');

/**
 * @swagger
 * /ranks:
 *   post:
 *     summary: Submit a rank entry for a series
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
router.post('/', submitRank);

/**
 * @swagger
 * /ranks/{seriesId}:
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

module.exports = router;