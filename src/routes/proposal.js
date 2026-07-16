const express = require('express');
const router = express.Router();
const upload = require('../middleware/cloudinaryUpload');
const { protect, authorize } = require('../middleware/auth');
const {
  createProposal,
  getProposals,
  getProposalById,
  downloadStoryboard,
  addComment,
  requestRevision,
  forwardProposal,
  rejectProposal,
  resubmitProposal,
  approveProposal,
} = require('../controllers/proposalController');

//Changed line
// Protect all routes
router.use(protect);

/**
 * Mangaka tạo proposal
 */
router.post('/', authorize('MANGAKA'), upload.single('storyboard'), createProposal);

/**
 * @swagger
 * /api/series/proposal:
 *   get:
 *     summary: Get proposals (optionally filtered by status)
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by proposal status
 *     responses:
 *       200:
 *         description: Return list of proposals
 */
router.get('/', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA'), getProposals);

/**
 * @swagger
 * /api/series/proposal/{id}:
 *   get:
 *     summary: Get a single proposal by ID
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Return proposal details
 */
router.get('/:id', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA'), getProposalById);

/**
 * Download storyboard
 */
router.get('/:id/storyboard', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER'), downloadStoryboard);

/**
 * @swagger
 * /api/series/proposal/{id}/comment:
 *   put:
 *     summary: Add a review comment to a proposal
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               isInternal:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Comment added successfully
 */
router.put('/:id/comment', authorize('ADMIN', 'EDITOR', 'MANGAKA', 'BOARD_MEMBER'), addComment);

/**
 * @swagger
 * /api/series/proposal/{id}/revision:
 *   put:
 *     summary: Request revision for a proposal (EDITOR/BOARD_MEMBER only)
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Revision requested
 */
router.put('/:id/revision', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER'), requestRevision);

/**
 * @swagger
 * /api/series/proposal/{id}/forward:
 *   put:
 *     summary: Forward proposal to the Board
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Proposal forwarded successfully
 */
router.put('/:id/forward', authorize('ADMIN', 'EDITOR'), forwardProposal);

/**
 * @swagger
 * /api/series/proposal/{id}/reject:
 *   put:
 *     summary: Reject a proposal
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Proposal rejected
 */
router.put('/:id/reject', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER'), rejectProposal);

/**
 * @swagger
 * /api/series/proposal/{id}/resubmit:
 *   put:
 *     summary: Resubmit proposal after revision (MANGAKA only)
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Proposal resubmitted
 */
router.put('/:id/resubmit', authorize('MANGAKA'), resubmitProposal);

/**
 * @swagger
 * /api/series/proposal/{id}/approve:
 *   put:
 *     summary: Approve proposal by Editorial Board (BOARD_MEMBER only)
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Proposal approved
 */
router.put('/:id/approve', authorize('ADMIN', 'BOARD_MEMBER'), approveProposal);

module.exports = router;