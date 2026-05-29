const express = require('express');
const router = express.Router();
const { submitVote, getMyVotes, updateVote, deleteVote } = require('../controllers/voteController.js');

/**
 * @swagger
 * /api/votes:
 *   post:
 *     summary: Submit a vote on a submission
 *     tags: [Votes (BOARD_MEMBER)]
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
 * /api/votes:
 *   get:
 *     summary: Get all votes by a user
 *     tags: [Votes (BOARD_MEMBER)]
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
router.get('/me', getMyVotes);

/**
 * @swagger
 * /api/votes/{voteId}:
 *   put:
 *     summary: Update a vote
 *     tags: [Votes (BOARD_MEMBER)]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: voteId
 *         required: true
 *         schema:
 *           type: string
 *         description: The vote ID to update
 *     responses:
 *       200:
 *         description: Vote updated successfully
 *       500:
 *         description: Server error
 */
router.put('/:voteId', updateVote);

/**
 * @swagger
 * /api/votes/{voteId}:
 *   delete:
 *     summary: Delete a vote
 *     tags: [Votes (BOARD_MEMBER)]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: voteId
 *         required: true
 *         schema:
 *           type: string
 *         description: The vote ID to delete
 *     responses:
 *       200:
 *         description: Vote deleted successfully
 *       500:
 *         description: Server error
 */
router.delete('/:voteId', deleteVote);



module.exports = router;