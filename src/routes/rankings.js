const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');
const {
  getRankings,
  updateScores,
  applyDirective,
} = require('../controllers/rankingsController.js');

/**
 * @swagger
 * /api/rankings:
 *   get:
 *     summary: Get rankings leaderboard (Board Member, Mangaka)
 *     tags: [Rankings]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [weekly, monthly]
 *         description: Ranking cycle type (default weekly)
 *     responses:
 *       200:
 *         description: Rankings data
 *       500:
 *         description: Server error
 */
router.get('/', protect, authorize('BOARD_MEMBER', 'MANGAKA'), getRankings);

/**
 * @swagger
 * /api/rankings/scores:
 *   put:
 *     summary: Update vote scores and re-sort rankings (Board Member)
 *     tags: [Rankings]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     votes:
 *                       type: number
 *     responses:
 *       200:
 *         description: Rankings updated
 *       500:
 *         description: Server error
 */
router.put('/scores', protect, authorize('BOARD_MEMBER'), updateScores);

/**
 * @swagger
 * /api/rankings/directive:
 *   post:
 *     summary: Apply board directive (axe/digital) to a ranking entry (Board Member)
 *     tags: [Rankings]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [axed, digital]
 *               cycle:
 *                 type: string
 *                 enum: [weekly, monthly]
 *     responses:
 *       200:
 *         description: Directive applied
 *       500:
 *         description: Server error
 */
router.post('/directive', protect, authorize('BOARD_MEMBER'), applyDirective);

module.exports = router;