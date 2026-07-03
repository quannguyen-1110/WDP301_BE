const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const {
  createProposal,
  getProposals,
  downloadStoryboard,
  forwardProposal,
  rejectProposal,
  resubmitProposal,
  approveProposal,
} = require('../controllers/proposalController');

// Protect all routes
router.use(protect);

/**
 * Mangaka tạo proposal
 */
router.post('/', authorize('MANGAKA'), upload.single('storyboard'), createProposal);

/**
 * Get proposals (ADMIN + EDITOR)
 */
router.get('/', authorize('ADMIN', 'EDITOR'), getProposals);

/**
 * Download storyboard
 */
router.get('/:id/storyboard', authorize('ADMIN', 'EDITOR'), downloadStoryboard);

/**
 * Forward proposal
 */
router.put('/:id/forward', authorize('ADMIN', 'EDITOR'), forwardProposal);

/**
 * @swagger
 * /api/series/proposal/{id}/reject:
 *   put:
 *     summary: Reject a proposal (EDITOR only)
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
router.put('/:id/approve', authorize('BOARD_MEMBER'), approveProposal);

module.exports = router;