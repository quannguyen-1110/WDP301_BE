const express = require('express');
const router = express.Router();
const { getSeriesRatings, submitRating } = require('../controllers/ratingController.js');

/**
 * @swagger
 * /ratings:
 *   post:
 *     summary: Submit a rating for a series
 *     tags: [Ratings]
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
 *               - submittedBy
 *             properties:
 *               seriesId:
 *                 type: string
 *                 example: 665series123...
 *               voteCount:
 *                 type: number
 *                 example: 5
 *               sourceFrom:
 *                 type: string
 *                 example: community_poll
 *               submittedBy:
 *                 type: string
 *                 example: 665user789...
 *     responses:
 *       201:
 *         description: Rating submitted successfully — monthly rank updated
 *       500:
 *         description: Server error
 */
router.post('/', submitRating);

/**
 * @swagger
 * /ratings/{seriesId}:
 *   get:
 *     summary: Get all ratings for a series
 *     tags: [Ratings]
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
 *         description: List of ratings returned
 *       500:
 *         description: Server error
 */
router.get('/:seriesId', getSeriesRatings);

module.exports = router;