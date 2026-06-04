const express = require('express');
const router = express.Router();
const { authorize } = require("../middleware/auth.js");
const {
  getSubmissionsBySeriesId,
  getAllSubmissions,
  createSubmission,
  updateSubmission,
  deleteSubmission,
  getSubmissionById,
  getVotesBySubmissionId,
  assignVoters,
  getVotingStatus,
} = require('../controllers/submissionController.js');

/**
 * @swagger
 * /api/submissions:
 *   post:
 *     summary: Create a submission (Mangaka)
 *     tags: [Submissions]
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
 *               - submissionType
 *               - action
 *             properties:
 *               seriesId:
 *                 type: string
 *                 example: 665series123...
 *               submissionType:
 *                 type: string
 *                 enum: [PITCH, POST_DECISION, CHANGE_EDITOR]
 *                 example: PITCH
 *               action:
 *                 type: string
 *                 enum: [APPROVE_WEEKLY, APPROVE_MONTHLY, CANCEL, CHANGE_FORMAT]
 *                 example: APPROVE_WEEKLY
 *     responses:
 *       201:
 *         description: Submission created successfully
 *       500:
 *         description: Server error
 */
router.post('/', authorize('MANGAKA'), createSubmission);

/**
 * @swagger
 * /api/submissions/all:
 *   get:
 *     summary: Get all submissions (Board Member)
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of submissions returned
 *       500:
 *         description: Server error
 */
router.get('/all', authorize('BOARD_MEMBER'), getAllSubmissions);

/**
 * @swagger
 * /api/submissions/series/{seriesId}:
 *   get:
 *     summary: Get all submissions by a series (Mangaka and Board Member)
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: seriesId
 *         required: true
 *         schema:
 *           type: string
 *         description: The series ID to filter submissions
 *     responses:
 *       200:
 *         description: List of submissions returned
 *       500:
 *         description: Server error
 */
router.get('/series/:seriesId', authorize('BOARD_MEMBER', 'MANGAKA'), getSubmissionsBySeriesId);

/**
 * @swagger
 * /api/submissions/{submissionId}/voters:
 *   post:
 *     summary: Assign required voters to a submission (Board Member)
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The submission ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["665user1...", "665user2..."]
 *     responses:
 *       200:
 *         description: Voters assigned successfully
 *       500:
 *         description: Server error
 */
router.post('/:submissionId/voters', authorize('BOARD_MEMBER'), assignVoters);

/**
 * @swagger
 * /api/submissions/{submissionId}/voters:
 *   get:
 *     summary: Get voting status for a submission (Board Member and Mangaka)
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The submission ID
 *     responses:
 *       200:
 *         description: Voting status returned
 *       500:
 *         description: Server error
 */
router.get('/:submissionId/voters', authorize('BOARD_MEMBER', 'MANGAKA'), getVotingStatus);

/**
 * @swagger
 * /api/submissions/{submissionId}:
 *   get:
 *     summary: Get a submission by ID (Mangaka and Board Member)
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The submission ID to get
 *     responses:
 *       200:
 *         description: Submission returned
 *       500:
 *         description: Server error
 */
router.get('/:submissionId', authorize('BOARD_MEMBER', 'MANGAKA'), getSubmissionById);

/**
 * @swagger
 * /api/submissions/{submissionId}/votes:
 *   get:
 *     summary: Get all votes for a submission (Board Member and Mangaka)
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The submission ID
 *     responses:
 *       200:
 *         description: List of votes returned
 *       500:
 *         description: Server error
 */
router.get('/:submissionId/votes', authorize('BOARD_MEMBER', 'MANGAKA'), getVotesBySubmissionId);

/**
 * @swagger
 * /api/submissions/{submissionId}:
 *   put:
 *     summary: Update a submission (Mangaka)
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The submission ID to update
 *     responses:
 *       200:
 *         description: Submission updated successfully
 *       500:
 *         description: Server error
 */
router.put('/:submissionId', authorize('MANGAKA'), updateSubmission);

/**
 * @swagger
 * /api/submissions/{submissionId}:
 *   delete:
 *     summary: Delete a submission (Mangaka)
 *     tags: [Submissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The submission ID to delete
 *     responses:
 *       200:
 *         description: Submission deleted successfully
 *       500:
 *         description: Server error
 */
router.delete('/:submissionId', authorize('MANGAKA'), deleteSubmission);

module.exports = router;