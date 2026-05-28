const express = require('express');
const router = express.Router();
const { submitVote, getMyVotes } = require('../controllers/voteController.js');

/**
 * @swagger
 * /votes:
 *   post:
 *     summary: Submit a vote on a submission
 *     tags: [Votes]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - submissionId
 *               - voterId
 *               - decision
 *             properties:
 *               submissionId:
 *                 type: string
 *                 example: 665sub123...
 *               voterId:
 *                 type: string
 *                 example: 665user789...
 *               decision:
 *                 type: string
 *                 enum: [ACCEPT, REJECT]
 *                 example: ACCEPT
 *               comment:
 *                 type: string
 *                 example: Great work on the shading!
 *     responses:
 *       201:
 *         description: Vote submitted successfully
 *       500:
 *         description: Server error
 */
router.post('/', submitVote);

/**
 * @swagger
 * /votes:
 *   get:
 *     summary: Get all votes by a user
 *     tags: [Votes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID to filter votes
 *     responses:
 *       200:
 *         description: List of votes returned
 *       500:
 *         description: Server error
 */
router.get('/', getMyVotes);

module.exports = router;