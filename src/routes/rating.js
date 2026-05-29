const express = require('express');
const router = express.Router();
const { getSeriesRatings, submitRating, updateRating, deleteRating } = require('../controllers/ratingController.js');
const { authorize } = require('../middleware/auth.js');

/**
 * @swagger
 * /api/ratings:
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
 * /api/ratings/{ratingId}:
 *   put:
 *     summary: Update a rating (Editor)
 *     tags: [Ratings]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: string
 *         description: The rating ID
 *     responses:
 *       200:
 *         description: Rating updated successfully
 *       500:
 *         description: Server error
 */
router.put('/:ratingId', authorize('EDITOR'), updateRating);

/**
 * @swagger
 * /api/ratings/{ratingId}:
 *   delete:
 *     summary: Delete a rating (Editor)
 *     tags: [Ratings]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: string
 *         description: The rating ID
 *     responses:
 *       200:
 *         description: Rating deleted successfully
 *       500:
 *         description: Server error
 */
router.delete('/:ratingId', authorize('EDITOR'), deleteRating);

/**
 * @swagger
 * /api/ratings/{seriesId}:
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