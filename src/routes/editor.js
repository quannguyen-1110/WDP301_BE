const express = require('express');
const router = express.Router();
const {
  getMySeries,
  getSeriesStats,
  getSeriesProgress,
  getDashboard,
} = require('../controllers/editorController.js');

/**
 * @swagger
 * /api/editor/my-series:
 *   get:
 *     summary: Get all series managed by this Tantou Editor
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of editor's series returned successfully
 */
router.get('/my-series', getMySeries);

/**
 * @swagger
 * /api/editor/series/{seriesId}/stats:
 *   get:
 *     summary: Get metrics & numbers of a series to defend before the editorial board
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: seriesId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Series metrics returned successfully
 *       404:
 *         description: Series not found or not assigned to editor
 */
router.get('/series/:seriesId/stats', getSeriesStats);

/**
 * @swagger
 * /api/editor/series/{seriesId}/progress:
 *   get:
 *     summary: Monitor real-time production progress of a studio/mangaka
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: seriesId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Series chapters production progress returned successfully
 *       404:
 *         description: Series not found or not assigned to editor
 */
router.get('/series/:seriesId/progress', getSeriesProgress);

/**
 * @swagger
 * /api/editor/dashboard:
 *   get:
 *     summary: Editor quick overview dashboard (series list, total chapters, upcoming deadlines)
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Editor dashboard statistics returned successfully
 */
router.get('/dashboard', getDashboard);

module.exports = router;
