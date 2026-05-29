const express = require('express');
const router = express.Router();
const { authorize } = require("../middleware/auth.js");
const { getSubmissionsBySeriesId, getAllSubmissions, createSubmission, updateSubmission, deleteSubmission, getSubmissionById, getVotesBySubmissionId } = require('../controllers/submissionController.js');

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
router.post('/', authorize('MANGAKA'), createSubmission);

/**
 * @swagger
 * /api/submissions/all:
 *   get:
 *     summary: Get all submissions (Board Member)
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
router.get('/all', authorize('BOARD_MEMBER'),  getAllSubmissions);


/**
 * @swagger
 * /api/submissions/{seriesId}:
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
 *         description: List of votes returned
 *       500:
 *         description: Server error
 */
router.get('/:seriesId', authorize('BOARD_MEMBER', 'MANGAKA'), getSubmissionsBySeriesId);

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
 *         description: List of votes returned
 *       500:
 *         description: Server error
 */
router.get('/:id', authorize('BOARD_MEMBER', 'MANGAKA'), getVotesBySubmissionId);


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
 *         description: List of votes returned
 *       500:
 *         description: Server error
 */
router.get('/:submissionId', authorize('BOARD_MEMBER', 'MANGAKA'), getSubmissionById);

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
 *         description: Vote updated successfully
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
 *         description: Vote deleted successfully
 *       500:
 *         description: Server error
 */
router.delete('/:submissionId', authorize('MANGAKA'), deleteSubmission);



module.exports = router;