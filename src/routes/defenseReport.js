const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const {
  createDefenseReport,
  getDefenseReports,
  getDefenseReportById,
  updateDefenseReport,
  submitDefenseReport,
  reviewDefenseReport,
} = require('../controllers/defenseReportController');

/**
 * @swagger
 * tags:
 *   name: DefenseReports
 *   description: Series Defense Workflow - Tantou Editor bảo vệ series trước Editorial Board
 */

/**
 * @swagger
 * /api/defense-reports:
 *   post:
 *     summary: Create a new defense report (EDITOR only)
 *     tags: [DefenseReports]
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
 *               - title
 *             properties:
 *               seriesId:
 *                 type: string
 *                 description: ID of the series to defend
 *               title:
 *                 type: string
 *                 description: Report title
 *               defenseArguments:
 *                 type: string
 *                 description: Arguments for defending the series
 *               improvementPlan:
 *                 type: string
 *                 description: Plan to improve the series
 *               readerGrowth:
 *                 type: string
 *                 description: Reader growth data
 *     responses:
 *       201:
 *         description: Defense report created in DRAFT status
 *       404:
 *         description: Series not found or editor not assigned
 */
router.post('/', authorize('EDITOR'), createDefenseReport);

/**
 * @swagger
 * /api/defense-reports:
 *   get:
 *     summary: Get defense reports (EDITOR sees own, BOARD_MEMBER sees submitted+)
 *     tags: [DefenseReports]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of defense reports
 */
router.get('/', authorize('EDITOR', 'BOARD_MEMBER'), getDefenseReports);

/**
 * @swagger
 * /api/defense-reports/{id}:
 *   get:
 *     summary: Get a defense report by ID
 *     tags: [DefenseReports]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Defense report ID
 *     responses:
 *       200:
 *         description: Defense report details
 *       404:
 *         description: Report not found
 */
router.get('/:id', authorize('EDITOR', 'BOARD_MEMBER'), getDefenseReportById);

/**
 * @swagger
 * /api/defense-reports/{id}:
 *   put:
 *     summary: Update a defense report (EDITOR only, DRAFT status only)
 *     tags: [DefenseReports]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               defenseArguments:
 *                 type: string
 *               improvementPlan:
 *                 type: string
 *               readerGrowth:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report updated
 *       400:
 *         description: Can only update DRAFT reports
 */
router.put('/:id', authorize('EDITOR'), updateDefenseReport);

/**
 * @swagger
 * /api/defense-reports/{id}/submit:
 *   post:
 *     summary: Submit defense report to Editorial Board (EDITOR only)
 *     tags: [DefenseReports]
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
 *         description: Report submitted (DRAFT → SUBMITTED)
 *       400:
 *         description: Can only submit DRAFT reports or missing defense arguments
 */
router.post('/:id/submit', authorize('EDITOR'), submitDefenseReport);

/**
 * @swagger
 * /api/defense-reports/{id}/review:
 *   post:
 *     summary: Review defense report (BOARD_MEMBER only)
 *     tags: [DefenseReports]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - decision
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [CONTINUE, CANCEL]
 *                 description: CONTINUE = approve series, CANCEL = cancel series
 *               reviewNote:
 *                 type: string
 *                 description: Review notes from board member
 *     responses:
 *       200:
 *         description: Report reviewed and decision applied
 *       400:
 *         description: Invalid decision or report not in SUBMITTED status
 */
router.post('/:id/review', authorize('BOARD_MEMBER'), reviewDefenseReport);

module.exports = router;
