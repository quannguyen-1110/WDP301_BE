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
} = require('../controllers/proposalController');

// All routes here require protection
router.use(protect);

/**
 * @swagger
 * /api/series/proposal:
 *   post:
 *     summary: Submit a new series proposal with storyboard (MANGAKA only)
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - genre
 *               - synopsis
 *               - storyboard
 *             properties:
 *               title:
 *                 type: string
 *               genre:
 *                 type: string
 *               synopsis:
 *                 type: string
 *               storyboard:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Proposal created
 *       403:
 *         description: Forbidden - Only MANGAKA
 */
router.post('/', authorize('MANGAKA'), upload.single('storyboard'), createProposal);

/**
 * @swagger
 * /api/series/proposal:
 *   get:
 *     summary: Get pending proposals (EDITOR only)
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Return list of proposals
 */
router.get('/', authorize('EDITOR'), getProposals);

/**
 * @swagger
 * /api/series/proposal/{id}/storyboard:
 *   get:
 *     summary: Download storyboard file for a proposal (EDITOR only)
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
 *         description: Binary file stream
 */
router.get('/:id/storyboard', authorize('EDITOR'), downloadStoryboard);

/**
 * @swagger
 * /api/series/proposal/{id}/forward:
 *   put:
 *     summary: Forward proposal to the Board (EDITOR only)
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Proposal forwarded successfully
 */
router.put('/:id/forward', authorize('EDITOR'), forwardProposal);

/**
 * @swagger
 * /api/series/proposal/{id}/reject:
 *   put:
 *     summary: Reject/request feedback for a proposal (EDITOR only)
 *     tags: [Proposals]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Proposal status updated to REJECTED
 */
router.put('/:id/reject', authorize('EDITOR'), rejectProposal);

module.exports = router;
